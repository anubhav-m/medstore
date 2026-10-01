import { randomUUID } from "node:crypto";
import {
  AdminRole,
  HistoryActorKind,
  NotificationEvent,
  OrderAction,
  OrderStatus,
} from "@medstore/shared";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../src/app.js";
import { Admin } from "../../../src/modules/admins/admin.model.js";
import { transitionOrder } from "../../../src/modules/orders/orderTransition.js";
import { Upload } from "../../../src/modules/uploads/upload.model.js";
import { User } from "../../../src/modules/users/user.model.js";
import { sendPushNotifications } from "../../../src/services/push.js";
import { createTestAdmin } from "../../helpers/admin.js";
import { runAction, seedStoreOrder } from "../../helpers/adminOrder.js";
import { ADDRESS, ONBOARDING, onboardedCustomer } from "../../helpers/customer.js";
import {
  NOW,
  ensureOrderIndexes,
  issueUpload,
  mockStorageOk,
  placeOrder,
  reorderOrder,
} from "../../helpers/order.js";
import { pushToken, storedTokens } from "../../helpers/push.js";
import { createTestStore, signInStaff } from "../../helpers/store.js";

vi.mock("../../../src/services/email.js", () => ({ sendCodeEmail: vi.fn() }));
vi.mock("../../../src/services/storage.js", () => ({
  verifyImageObject: vi.fn(),
  createSignedViewUrls: vi.fn(),
}));
vi.mock("../../../src/services/push.js", async (importOriginal) => ({
  ...(await importOriginal()),
  sendPushNotifications: vi.fn(),
}));

const S = OrderStatus;
const E = NotificationEvent;

const TOKENS = {
  customer: pushToken("customer"),
  otherCustomer: pushToken("other-customer"),
  owner: pushToken("owner"),
  inactiveOwner: pushToken("inactive-owner"),
  staff: pushToken("staff"),
  otherStoreStaff: pushToken("other-store-staff"),
};
// Active staff of ST01 and every active owner.
const ADMIN_RECIPIENTS = [TOKENS.owner, TOKENS.staff].sort();

// Nothing a lock screen may show: items, patient, notes, customer contact or address.
const PERSONAL_DATA = [
  "Paracetamol",
  "ORS",
  "Ravi Rao",
  "Old note",
  "Two strips please",
  ONBOARDING.name,
  "9876543210",
  ADDRESS.label,
  ADDRESS.line1,
  ADDRESS.city,
  ADDRESS.pincode,
];

const giveToken = (Model, filter, token) =>
  Model.updateOne(filter, { $set: { pushTokens: [{ token, createdAt: NOW }] } });

let app;
let customer;
let store;
let staff;
beforeAll(ensureOrderIndexes);
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  mockStorageOk();
  vi.mocked(sendPushNotifications).mockResolvedValue({ unregisteredTokens: [] });
  app = createApp();
  customer = await onboardedCustomer(app, "asha@example.com");
  const otherCustomer = await onboardedCustomer(app, "ravi@example.com");
  store = await createTestStore();
  const otherStore = await createTestStore({ code: "ST02" });
  staff = await signInStaff(app, [store.code]);
  await createTestAdmin();
  await createTestAdmin({ username: "owner.off", isActive: false });
  await createTestAdmin({
    username: "staff.two",
    role: AdminRole.STAFF,
    storeCodes: [otherStore.code],
  });

  await giveToken(User, { _id: customer.user.id }, TOKENS.customer);
  await giveToken(User, { _id: otherCustomer.user.id }, TOKENS.otherCustomer);
  await giveToken(Admin, { username: "owner.one" }, TOKENS.owner);
  await giveToken(Admin, { username: "owner.off" }, TOKENS.inactiveOwner);
  await giveToken(Admin, { username: "staff.one" }, TOKENS.staff);
  await giveToken(Admin, { username: "staff.two" }, TOKENS.otherStoreStaff);
});
afterEach(() => {
  vi.useRealTimers();
});

// Sends start in the background after the response, so wait for them.
const waitForSends = async (count) => {
  await vi.waitFor(() => expect(sendPushNotifications).toHaveBeenCalledTimes(count));
  return vi.mocked(sendPushNotifications).mock.calls.map(([messages]) => messages);
};
const onlySend = async () => (await waitForSends(1))[0];

const recipients = (messages) => messages.map((message) => message.to).sort();

const expectSent = (messages, { to, event, orderId, title, body }) => {
  expect(recipients(messages)).toEqual([...to].sort());
  for (const message of messages) {
    expect(message).toEqual({ to: message.to, title, body, data: { orderId, event } });
    for (const value of PERSONAL_DATA) expect(`${title} ${body}`).not.toContain(value);
  }
};

const seed = (status) => seedStoreOrder(customer, store, status);

describe("order placed", () => {
  it("notifies active staff of the store and active owners, nobody else", async () => {
    const imagePaths = [await issueUpload(customer.user.id)];
    const res = await placeOrder(customer.api, {
      storeId: store.id,
      addressId: customer.address.id,
      imagePaths,
      note: "Two strips please",
    });
    expect(res.status).toBe(200);
    const { id, orderNumber } = res.body.data.order;

    expectSent(await onlySend(), {
      to: ADMIN_RECIPIENTS,
      event: E.ORDER_PLACED,
      orderId: id,
      title: `New order ${orderNumber}`,
      body: "Tap to review the prescription.",
    });
  });

  it("notifies once when the same Idempotency-Key is sent again", async () => {
    const body = {
      storeId: store.id,
      addressId: customer.address.id,
      imagePaths: [await issueUpload(customer.user.id)],
    };
    const key = randomUUID();
    const first = await placeOrder(customer.api, body, key);
    await onlySend();

    const replay = await placeOrder(customer.api, body, key);
    expect(replay.body.data.order.id).toBe(first.body.data.order.id);
    await runAction(staff, first.body.data.order.id, OrderAction.REJECT).expect(200);

    const events = (await waitForSends(2)).map(([message]) => message.data.event);
    expect(events).toEqual([E.ORDER_PLACED, E.ORDER_REJECTED]);
  });

  it("notifies staff of a reorder", async () => {
    const path = await issueUpload(customer.user.id);
    await Upload.updateOne({ path }, { $set: { attachedAt: NOW } });
    const source = await seedStoreOrder(customer, store, S.DELIVERED, { images: [{ path }] });

    const res = await reorderOrder(customer.api, source._id);
    expect(res.status).toBe(200);

    expectSent(await onlySend(), {
      to: ADMIN_RECIPIENTS,
      event: E.ORDER_PLACED,
      orderId: res.body.data.order.id,
      title: `New order ${res.body.data.order.orderNumber}`,
      body: "Tap to review the prescription.",
    });
  });
});

describe("staff actions notify the customer only", () => {
  it.each([
    [
      OrderAction.REJECT,
      S.PENDING_REVIEW,
      E.ORDER_REJECTED,
      (n) => [`Order ${n} couldn't be accepted`, "Tap to see why."],
    ],
    [
      OrderAction.SEND_BILL,
      S.PENDING_REVIEW,
      E.BILL_SENT,
      // ₹80 of items + ₹25 delivery; 60 minutes after 12:00 IST.
      (n) => ["Your bill is ready", `${n} · ₹105. Please confirm by 1:00 pm.`],
    ],
    [
      OrderAction.REVISE_BILL,
      S.AWAITING_CONFIRMATION,
      E.BILL_REVISED,
      (n) => ["Your bill was updated", `${n} · ₹105. Please review and confirm by 1:00 pm.`],
    ],
    [
      OrderAction.STAFF_CANCEL,
      S.CONFIRMED,
      E.CANCELLED_BY_STORE,
      (n) => [`Order ${n} was cancelled by the store`, "Tap for details."],
    ],
    [
      OrderAction.DISPATCH,
      S.PACKED,
      E.OUT_FOR_DELIVERY,
      (n) => ["Your order is on the way", `${n} · keep ₹80 ready.`],
    ],
    [
      OrderAction.DELIVER,
      S.OUT_FOR_DELIVERY,
      E.DELIVERED,
      (n) => [`Order ${n} delivered`, "Thank you for ordering with us."],
    ],
    [
      OrderAction.FAIL_DELIVERY,
      S.OUT_FOR_DELIVERY,
      E.DELIVERY_FAILED,
      (n) => [`We couldn't deliver order ${n}`, "Tap for details."],
    ],
  ])("%s from %s sends %s", async (action, status, event, texts) => {
    const order = await seed(status);
    await runAction(staff, order._id, action).expect(200);

    const [title, body] = texts(order.orderNumber);
    expectSent(await onlySend(), {
      to: [TOKENS.customer],
      event,
      orderId: String(order._id),
      title,
      body,
    });
  });

  it("PACK notifies nobody", async () => {
    const order = await seed(S.CONFIRMED);
    await runAction(staff, order._id, OrderAction.PACK).expect(200);
    await runAction(staff, order._id, OrderAction.DISPATCH).expect(200);

    const [messages] = await waitForSends(1);
    expect(messages[0].data.event).toBe(E.OUT_FOR_DELIVERY);
  });
});

describe("customer actions notify staff of the store and owners", () => {
  it("confirming the bill", async () => {
    const order = await seed(S.AWAITING_CONFIRMATION);
    await customer.api.post(`/orders/${order._id}/confirm`).send({ billVersion: 1 }).expect(200);

    expectSent(await onlySend(), {
      to: ADMIN_RECIPIENTS,
      event: E.CUSTOMER_CONFIRMED,
      orderId: String(order._id),
      title: `${order.orderNumber} confirmed`,
      body: "Ready to pack.",
    });
  });

  it("cancelling", async () => {
    const order = await seed(S.PENDING_REVIEW);
    await customer.api.post(`/orders/${order._id}/cancel`).send({}).expect(200);

    expectSent(await onlySend(), {
      to: ADMIN_RECIPIENTS,
      event: E.CUSTOMER_CANCELLED,
      orderId: String(order._id),
      title: `${order.orderNumber} cancelled by the customer`,
      body: "No action needed.",
    });
  });
});

describe("bill expired (system cancel)", () => {
  it("tells the customer and the store's staff and owners, each in their own words", async () => {
    const order = await seed(S.AWAITING_CONFIRMATION);
    await transitionOrder({
      orderId: order._id,
      action: OrderAction.EXPIRE_BILL,
      by: { kind: HistoryActorKind.SYSTEM },
    });

    const messages = await onlySend();
    const orderId = String(order._id);
    const n = order.orderNumber;
    expectSent(
      messages.filter((message) => message.to === TOKENS.customer),
      {
        to: [TOKENS.customer],
        event: E.BILL_EXPIRED,
        orderId,
        title: `Order ${n} was cancelled`,
        body: "The bill wasn't confirmed in time.",
      },
    );
    expectSent(
      messages.filter((message) => message.to !== TOKENS.customer),
      {
        to: ADMIN_RECIPIENTS,
        event: E.BILL_EXPIRED,
        orderId,
        title: `${n} expired`,
        body: "The customer didn't confirm the bill.",
      },
    );
  });
});

describe("delivery problems", () => {
  it("a failed push changes neither the response nor its status code", async () => {
    vi.mocked(sendPushNotifications).mockRejectedValue(new Error("Expo is down"));
    const order = await seed(S.PENDING_REVIEW);

    const res = await runAction(staff, order._id, OrderAction.REJECT);
    await onlySend();

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      message: "Order rejected",
      data: { order: { status: S.REJECTED } },
    });
  });

  it("a failed recipient lookup changes neither the response nor its status code", async () => {
    const find = vi.spyOn(Admin, "find").mockImplementation(() => {
      throw new Error("lookup failed");
    });
    const order = await seed(S.AWAITING_CONFIRMATION);

    const res = await customer.api.post(`/orders/${order._id}/confirm`).send({ billVersion: 1 });
    await vi.waitFor(() => expect(find).toHaveBeenCalled());
    find.mockRestore();

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: { order: { status: S.CONFIRMED } } });
    expect(sendPushNotifications).not.toHaveBeenCalled();
  });

  it("deletes tokens Expo reports as DeviceNotRegistered", async () => {
    vi.mocked(sendPushNotifications).mockResolvedValue({ unregisteredTokens: [TOKENS.customer] });
    const order = await seed(S.PENDING_REVIEW);

    await runAction(staff, order._id, OrderAction.REJECT).expect(200);

    await vi.waitFor(async () =>
      expect(await storedTokens(User, { _id: customer.user.id })).toEqual([]),
    );
    expect(await storedTokens(Admin, { username: "owner.one" })).toEqual([TOKENS.owner]);
  });
});
