import {
  DeliveryFailedReason,
  ErrorCodes,
  HistoryActorKind,
  ORDER_TRANSITIONS,
  OrderStatus,
  PaymentStatus,
  StaffCancelReason,
  TransitionActor,
} from "@medstore/shared";
import mongoose from "mongoose";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../src/app.js";
import { Admin } from "../../../src/modules/admins/admin.model.js";
import { Order } from "../../../src/modules/orders/order.model.js";
import { expectError } from "../../helpers/admin.js";
import {
  ACTION_REQUESTS,
  expectNoAdminInternalFields,
  runAction,
  seedStoreOrder,
} from "../../helpers/adminOrder.js";
import { onboardedCustomer } from "../../helpers/customer.js";
import {
  NOW,
  ensureOrderIndexes,
  holdOrderUpdatesUntil,
  mockStorageOk,
} from "../../helpers/order.js";
import { createTestStore, signInStaff } from "../../helpers/store.js";

vi.mock("../../../src/services/email.js", () => ({ sendCodeEmail: vi.fn() }));
vi.mock("../../../src/services/storage.js", () => ({
  verifyImageObject: vi.fn(),
  createSignedViewUrls: vi.fn(),
}));

const S = OrderStatus;

let app;
let customer;
let store;
let staff;
let staffId;
beforeAll(ensureOrderIndexes);
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  mockStorageOk();
  app = createApp();
  customer = await onboardedCustomer(app, "asha@example.com");
  store = await createTestStore();
  staff = await signInStaff(app, [store.code]);
  staffId = String((await Admin.findOne({ username: "staff.one" }).lean())._id);
});
afterEach(() => {
  vi.useRealTimers();
});

const seed = (status, extra) => seedStoreOrder(customer, store, status, extra);
const stored = (orderId) => Order.findById(orderId).lean();
const post = (orderId, path, body) => staff.post(`/orders/${orderId}/${path}`).send(body);

const expectAdminEntry = (entry, status, note = null) =>
  expect(entry).toEqual({
    status,
    at: NOW.toISOString(),
    by: { kind: HistoryActorKind.ADMIN, id: staffId, name: "Staff One" },
    note,
  });

describe("every staff transition in the shared table", () => {
  const staffTransitions = ORDER_TRANSITIONS.filter((t) => t.actor === TransitionActor.STAFF);

  it("has an endpoint for each staff action", () => {
    expect(Object.keys(ACTION_REQUESTS).sort()).toEqual(
      staffTransitions.map((t) => t.action).sort(),
    );
  });

  it.each(
    staffTransitions.flatMap((transition) =>
      Object.values(S).map((status) => [
        transition.action,
        status,
        transition.from.includes(status),
        transition,
      ]),
    ),
  )("%s from %s → allowed: %s", async (action, status, allowed, transition) => {
    const order = await seed(status);

    const res = await runAction(staff, order._id, action);

    if (!allowed) {
      expectError(res, 409, ErrorCodes.INVALID_ORDER_TRANSITION);
      expect((await stored(order._id)).status).toBe(status);
      return;
    }
    expect(res.status).toBe(200);
    expect(res.body.data.order.status).toBe(transition.to);
    expect(res.body.data.order.statusHistory.at(-1).by).toEqual({
      kind: HistoryActorKind.ADMIN,
      id: staffId,
      name: "Staff One",
    });
    expectNoAdminInternalFields(res.body);
    expect(res.body.data.order).not.toHaveProperty("imageUrls");
  });
});

describe("POST /admin/orders/:id/reject", () => {
  it("rejects with a reason and note, recorded on the order and its history", async () => {
    const order = await seed(S.PENDING_REVIEW);

    const res = await post(order._id, "reject", {
      reasonCode: "OTHER",
      note: " Photo is of a receipt ",
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Order rejected");
    const view = res.body.data.order;
    expect(view.status).toBe(S.REJECTED);
    expect(view.rejection).toEqual({ code: "OTHER", note: "Photo is of a receipt" });
    expectAdminEntry(view.statusHistory.at(-1), S.REJECTED, "Photo is of a receipt");
    expect(String((await stored(order._id)).statusHistory.at(-1).by.id)).toBe(staffId);
  });

  it.each([
    ["no reason", {}, "reasonCode"],
    ["a reason from another list", { reasonCode: "PRESCRIPTION_INVALID" }, "reasonCode"],
    ["OTHER without a note", { reasonCode: "OTHER" }, "note"],
    ["a 301-character note", { reasonCode: "OTHER", note: "x".repeat(301) }, "note"],
    ["a status field", { reasonCode: "PRESCRIPTION_UNCLEAR", status: S.REJECTED }, "status"],
  ])("rejects %s with 400 VALIDATION_ERROR", async (_case, body, field) => {
    const order = await seed(S.PENDING_REVIEW);
    const res = await post(order._id, "reject", body);

    expectError(res, 400, ErrorCodes.VALIDATION_ERROR);
    expect(res.body.errors.map((error) => error.field)).toContain(field);
    expect((await stored(order._id)).status).toBe(S.PENDING_REVIEW);
  });

  it("accepts a 300-character note", async () => {
    const order = await seed(S.PENDING_REVIEW);
    const res = await post(order._id, "reject", { reasonCode: "OTHER", note: "x".repeat(300) });
    expect(res.status).toBe(200);
  });
});

describe("POST /admin/orders/:id/pack and /dispatch", () => {
  it("packs a confirmed order, then dispatches it", async () => {
    const order = await seed(S.CONFIRMED);

    const packed = await staff.post(`/orders/${order._id}/pack`);
    expect(packed.status).toBe(200);
    expect(packed.body.message).toBe("Order packed");
    expectAdminEntry(packed.body.data.order.statusHistory.at(-1), S.PACKED);

    const dispatched = await staff.post(`/orders/${order._id}/dispatch`).send({});
    expect(dispatched.status).toBe(200);
    expect(dispatched.body.message).toBe("Order out for delivery");
    expect(dispatched.body.data.order.status).toBe(S.OUT_FOR_DELIVERY);
  });

  it("rejects any input with 400 VALIDATION_ERROR", async () => {
    const order = await seed(S.CONFIRMED);
    expectError(await post(order._id, "pack", { status: S.DELIVERED }), 400, "VALIDATION_ERROR");
    expect((await stored(order._id)).status).toBe(S.CONFIRMED);
  });

  it("lets one of two staff packing at the same moment win; the other gets ORDER_STATUS_CHANGED", async () => {
    const other = await signInStaff(app, [store.code], "staff.two");
    const order = await seed(S.CONFIRMED);
    const spy = holdOrderUpdatesUntil(2);
    try {
      const results = await Promise.all([
        staff.post(`/orders/${order._id}/pack`),
        other.post(`/orders/${order._id}/pack`),
      ]);

      expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
      expectError(
        results.find((res) => res.status === 409),
        409,
        ErrorCodes.ORDER_STATUS_CHANGED,
      );
      const history = (await stored(order._id)).statusHistory;
      expect(history.filter((entry) => entry.status === S.PACKED)).toHaveLength(1);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("POST /admin/orders/:id/deliver", () => {
  it("records the cash collected, payment status and delivery time", async () => {
    const order = await seed(S.OUT_FOR_DELIVERY);

    const res = await post(order._id, "deliver", { cashCollectedPaise: 7500 });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Order delivered");
    expect(res.body.data.order).toMatchObject({
      status: S.DELIVERED,
      paymentStatus: PaymentStatus.COLLECTED,
      cashCollectedPaise: 7500,
      deliveredAt: NOW.toISOString(),
    });
    expectAdminEntry(res.body.data.order.statusHistory.at(-1), S.DELIVERED);
  });

  it("accepts zero cash collected", async () => {
    const order = await seed(S.OUT_FOR_DELIVERY);
    const res = await post(order._id, "deliver", { cashCollectedPaise: 0 });
    expect(res.body.data.order.cashCollectedPaise).toBe(0);
  });

  it.each([
    ["missing", {}],
    ["negative", { cashCollectedPaise: -1 }],
    ["a decimal", { cashCollectedPaise: 75.5 }],
    ["a string", { cashCollectedPaise: "7500" }],
    ["beyond a safe integer", { cashCollectedPaise: 1e20 }],
    ["null", { cashCollectedPaise: null }],
    ["an extra field", { cashCollectedPaise: 7500, paymentStatus: "PENDING" }],
  ])("rejects %s cash with 400 VALIDATION_ERROR", async (_case, body) => {
    const order = await seed(S.OUT_FOR_DELIVERY);
    expectError(await post(order._id, "deliver", body), 400, ErrorCodes.VALIDATION_ERROR);
    expect((await stored(order._id)).status).toBe(S.OUT_FOR_DELIVERY);
  });
});

describe("POST /admin/orders/:id/fail", () => {
  it("records why the delivery failed", async () => {
    const order = await seed(S.OUT_FOR_DELIVERY);

    const res = await post(order._id, "fail", {
      reasonCode: DeliveryFailedReason.WRONG_ADDRESS,
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Delivery marked as failed");
    expect(res.body.data.order).toMatchObject({
      status: S.DELIVERY_FAILED,
      deliveryFailure: { code: DeliveryFailedReason.WRONG_ADDRESS, note: null },
      paymentStatus: PaymentStatus.PENDING,
    });
  });

  it.each([
    ["no reason", {}],
    ["a cancel reason", { reasonCode: StaffCancelReason.CUSTOMER_REQUESTED }],
    ["OTHER without a note", { reasonCode: "OTHER" }],
  ])("rejects %s with 400 VALIDATION_ERROR", async (_case, body) => {
    const order = await seed(S.OUT_FOR_DELIVERY);
    expectError(await post(order._id, "fail", body), 400, ErrorCodes.VALIDATION_ERROR);
  });
});

describe("POST /admin/orders/:id/cancel", () => {
  it("cancels as the store, with the reason", async () => {
    const order = await seed(S.PACKED);

    const res = await post(order._id, "cancel", {
      reasonCode: StaffCancelReason.OTHER,
      note: "Shop flooded",
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Order cancelled");
    expect(res.body.data.order.cancellation).toEqual({
      byKind: HistoryActorKind.ADMIN,
      code: StaffCancelReason.OTHER,
      note: "Shop flooded",
    });
    expectAdminEntry(res.body.data.order.statusHistory.at(-1), S.CANCELLED, "Shop flooded");
  });

  it.each([
    ["no reason", {}],
    ["a customer reason", { reasonCode: "CHANGED_MIND" }],
    ["OTHER without a note", { reasonCode: "OTHER" }],
  ])("rejects %s with 400 VALIDATION_ERROR", async (_case, body) => {
    const order = await seed(S.CONFIRMED);
    expectError(await post(order._id, "cancel", body), 400, ErrorCodes.VALIDATION_ERROR);
  });
});

describe("unknown orders", () => {
  it.each(Object.entries(ACTION_REQUESTS))(
    "%s returns 404 ORDER_NOT_FOUND for an order that doesn't exist",
    async (action) => {
      const res = await runAction(staff, new mongoose.Types.ObjectId(), action);
      expectError(res, 404, ErrorCodes.ORDER_NOT_FOUND);
    },
  );

  it("returns 400 INVALID_ID for a malformed id", async () => {
    expectError(await staff.post("/orders/nope/pack"), 400, ErrorCodes.INVALID_ID);
  });
});
