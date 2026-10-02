import {
  ErrorCodes,
  HistoryActorKind,
  NotificationEvent,
  OrderAction,
  OrderStatus,
  SystemCancelReason,
} from "@medstore/shared";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { logger } from "../../src/config/logger.js";
import {
  expireUnconfirmedBills,
  runScheduledBillExpiry,
} from "../../src/jobs/expireUnconfirmedBills.js";
import { Order } from "../../src/modules/orders/order.model.js";
import { User } from "../../src/modules/users/user.model.js";
import { sendPushNotifications } from "../../src/services/push.js";
import { runAction, seedStoreOrder } from "../helpers/adminOrder.js";
import { onboardedCustomer } from "../helpers/customer.js";
import {
  NOW,
  ensureOrderIndexes,
  holdOrderUpdatesUntil,
  issueUpload,
  mockStorageOk,
  placeOrder,
} from "../helpers/order.js";
import { pushToken } from "../helpers/push.js";
import { createTestStore, signInStaff } from "../helpers/store.js";

vi.mock("../../src/services/email.js", () => ({ sendCodeEmail: vi.fn() }));
vi.mock("../../src/services/storage.js", () => ({
  verifyImageObject: vi.fn(),
  createSignedViewUrls: vi.fn(),
}));
vi.mock("../../src/services/push.js", async (importOriginal) => ({
  ...(await importOriginal()),
  sendPushNotifications: vi.fn(),
}));

const S = OrderStatus;
const MINUTE_MS = 60 * 1000;
const at = (minutes) => new Date(NOW.getTime() + minutes * MINUTE_MS);
const CUSTOMER_TOKEN = pushToken("customer");
const NOTHING_DONE = { expired: 0, skipped: 0, failed: 0 };

let app;
let customer;
let store;
beforeAll(ensureOrderIndexes);
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  mockStorageOk();
  vi.mocked(sendPushNotifications).mockResolvedValue({ unregisteredTokens: [] });
  app = createApp();
  customer = await onboardedCustomer(app, "asha@example.com");
  store = await createTestStore();
  await User.updateOne(
    { _id: customer.user.id },
    { $set: { pushTokens: [{ token: CUSTOMER_TOKEN, createdAt: NOW }] } },
  );
});
afterEach(() => {
  vi.useRealTimers();
});

// A bill 1 sent an hour before it expires at `expiresAt`.
const seedBill = (expiresAt) =>
  seedStoreOrder(customer, store, S.AWAITING_CONFIRMATION, {
    billSentAt: new Date(expiresAt.getTime() - 60 * MINUTE_MS),
    billExpiresAt: expiresAt,
  });

const reload = (order) => Order.findById(order._id).lean();

const systemEntries = (order) =>
  order.statusHistory.filter((entry) => entry.by.kind === HistoryActorKind.SYSTEM);

// Runs `action` after the job has read the order but before its conditional update writes.
const beforeNextUpdate = (action) => {
  const original = Order.findOneAndUpdate;
  return vi.spyOn(Order, "findOneAndUpdate").mockImplementationOnce(function (...args) {
    const query = original.apply(this, args);
    const exec = query.exec.bind(query);
    query.exec = async () => {
      await action();
      return exec();
    };
    return query;
  });
};

describe("expireUnconfirmedBills", () => {
  it("cancels an expired bill as SYSTEM, frees an open-order slot and tells the customer", async () => {
    const order = await seedBill(at(-30));
    await seedStoreOrder(customer, store);
    await seedStoreOrder(customer, store);
    const body = {
      storeId: store.id,
      addressId: customer.address.id,
      imagePaths: [await issueUpload(customer.user.id)],
    };
    const blocked = await placeOrder(customer.api, body);
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe(ErrorCodes.TOO_MANY_OPEN_ORDERS);

    expect(await expireUnconfirmedBills(NOW)).toEqual({ ...NOTHING_DONE, expired: 1 });

    const cancelled = await reload(order);
    expect(cancelled.status).toBe(S.CANCELLED);
    expect(cancelled.cancellation).toEqual({
      byKind: HistoryActorKind.SYSTEM,
      code: SystemCancelReason.BILL_EXPIRED,
      note: null,
    });
    expect(cancelled.statusHistory.at(-1)).toEqual({
      status: S.CANCELLED,
      at: NOW,
      by: { kind: HistoryActorKind.SYSTEM, id: null },
      note: "Bill not confirmed in time",
    });

    const detail = await customer.api.get(`/orders/${order._id}`).expect(200);
    expect(detail.body.data.order).toMatchObject({
      status: S.CANCELLED,
      cancellation: { byKind: HistoryActorKind.SYSTEM, code: SystemCancelReason.BILL_EXPIRED },
    });

    await vi.waitFor(() => expect(sendPushNotifications).toHaveBeenCalledTimes(1));
    const [[messages]] = vi.mocked(sendPushNotifications).mock.calls;
    expect(messages).toEqual([
      {
        to: CUSTOMER_TOKEN,
        title: `Order ${order.orderNumber} was cancelled`,
        body: "The bill wasn't confirmed in time.",
        data: { orderId: String(order._id), event: NotificationEvent.BILL_EXPIRED },
      },
    ]);

    expect((await placeOrder(customer.api, body)).status).toBe(200);
  });

  it("cancels a bill expiring exactly now and leaves one just under the timeout", async () => {
    const due = await seedBill(NOW);
    const almost = await seedBill(new Date(NOW.getTime() + 1));

    expect(await expireUnconfirmedBills(NOW)).toEqual({ ...NOTHING_DONE, expired: 1 });

    expect((await reload(due)).status).toBe(S.CANCELLED);
    const untouched = await reload(almost);
    expect(untouched.status).toBe(S.AWAITING_CONFIRMATION);
    expect(systemEntries(untouched)).toEqual([]);
  });

  it("restarts the timeout when the bill is revised", async () => {
    const order = await seedBill(at(10));
    const staff = await signInStaff(app, [store.code]);
    await runAction(staff, order._id, OrderAction.REVISE_BILL).expect(200);

    expect(await expireUnconfirmedBills(at(30))).toEqual(NOTHING_DONE);
    expect((await reload(order)).status).toBe(S.AWAITING_CONFIRMATION);

    expect(await expireUnconfirmedBills(at(60))).toEqual({ ...NOTHING_DONE, expired: 1 });
    expect((await reload(order)).status).toBe(S.CANCELLED);
  });

  it("leaves orders in other statuses alone, whatever their bill expiry", async () => {
    const pending = await seedStoreOrder(customer, store);
    const confirmed = await seedStoreOrder(customer, store, S.CONFIRMED, {
      billExpiresAt: at(-30),
    });

    expect(await expireUnconfirmedBills(NOW)).toEqual(NOTHING_DONE);

    expect((await reload(pending)).status).toBe(S.PENDING_REVIEW);
    expect((await reload(confirmed)).status).toBe(S.CONFIRMED);
  });

  it("skips an order the customer confirmed between the query and the update", async () => {
    const order = await seedBill(at(1));
    const errors = vi.spyOn(logger, "error");
    const spy = beforeNextUpdate(() =>
      customer.api.post(`/orders/${order._id}/confirm`).send({ billVersion: 1 }).expect(200),
    );

    const result = await expireUnconfirmedBills(at(2));
    spy.mockRestore();

    expect(result).toEqual({ ...NOTHING_DONE, skipped: 1 });
    const confirmed = await reload(order);
    expect(confirmed.status).toBe(S.CONFIRMED);
    expect(systemEntries(confirmed)).toEqual([]);
    expect(errors).not.toHaveBeenCalled();
  });

  it("skips an order whose bill was revised between the query and the update", async () => {
    const order = await seedBill(at(-5));
    const staff = await signInStaff(app, [store.code]);
    const spy = beforeNextUpdate(() =>
      runAction(staff, order._id, OrderAction.REVISE_BILL).expect(200),
    );

    const result = await expireUnconfirmedBills(NOW);
    spy.mockRestore();

    expect(result).toEqual({ ...NOTHING_DONE, skipped: 1 });
    const revised = await reload(order);
    expect(revised).toMatchObject({ status: S.AWAITING_CONFIRMATION, billVersion: 2 });
    expect(revised.billExpiresAt).toEqual(at(60));
  });

  it("logs a failed order by id and still expires the rest of the batch", async () => {
    const failing = await seedBill(at(-20));
    const next = await seedBill(at(-10));
    const errors = vi.spyOn(logger, "error");
    const spy = vi.spyOn(Order, "findOneAndUpdate").mockImplementationOnce(() => {
      throw new Error("write failed");
    });

    const result = await expireUnconfirmedBills(NOW);
    spy.mockRestore();

    expect(result).toEqual({ expired: 1, skipped: 0, failed: 1 });
    expect((await reload(failing)).status).toBe(S.AWAITING_CONFIRMATION);
    expect((await reload(next)).status).toBe(S.CANCELLED);
    expect(errors).toHaveBeenCalledTimes(1);
    expect(errors).toHaveBeenCalledWith(
      { err: expect.any(Error), orderId: String(failing._id) },
      "bill expiry failed",
    );
  });

  it("cancels at most 100 orders per run, earliest expiry first", async () => {
    // No token, so 101 background pushes don't outlive this test.
    await User.updateOne({ _id: customer.user.id }, { $set: { pushTokens: [] } });
    const orders = await Promise.all(
      Array.from({ length: 101 }, (_, index) => seedBill(at(-200 + index))),
    );

    expect(await expireUnconfirmedBills(NOW)).toEqual({ ...NOTHING_DONE, expired: 100 });
    expect((await reload(orders.at(-1))).status).toBe(S.AWAITING_CONFIRMATION);

    expect(await expireUnconfirmedBills(NOW)).toEqual({ ...NOTHING_DONE, expired: 1 });
    expect((await reload(orders.at(-1))).status).toBe(S.CANCELLED);
  });

  it("cancels each order once when two runs overlap", async () => {
    const orders = await Promise.all([seedBill(at(-30)), seedBill(at(-20)), seedBill(at(-10))]);
    const hold = holdOrderUpdatesUntil(2);

    const results = await Promise.all([expireUnconfirmedBills(NOW), expireUnconfirmedBills(NOW)]);
    hold.mockRestore();

    expect(results.reduce((sum, { expired }) => sum + expired, 0)).toBe(3);
    expect(results.reduce((sum, { skipped }) => sum + skipped, 0)).toBe(3);
    expect(results.every(({ failed }) => failed === 0)).toBe(true);
    for (const order of orders) {
      const reloaded = await reload(order);
      expect(reloaded.status).toBe(S.CANCELLED);
      expect(systemEntries(reloaded)).toHaveLength(1);
    }
    await vi.waitFor(() => expect(sendPushNotifications).toHaveBeenCalledTimes(3));
  });
});

describe("runScheduledBillExpiry", () => {
  it("skips a tick while the previous run is still going", async () => {
    await seedBill(at(-30));

    const [first, second] = await Promise.all([
      runScheduledBillExpiry(NOW),
      runScheduledBillExpiry(NOW),
    ]);

    expect(first).toEqual({ ...NOTHING_DONE, expired: 1 });
    expect(second).toBeNull();
    expect(await runScheduledBillExpiry(NOW)).toEqual(NOTHING_DONE);
  });
});
