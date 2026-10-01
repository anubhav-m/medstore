import { CustomerCancelReason, ErrorCodes, HistoryActorKind, OrderStatus } from "@medstore/shared";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../src/app.js";
import { Order } from "../../../src/modules/orders/order.model.js";
import { createSignedViewUrls } from "../../../src/services/storage.js";
import { expectError } from "../../helpers/admin.js";
import { onboardedCustomer } from "../../helpers/customer.js";
import {
  NOW,
  billFields,
  ensureOrderIndexes,
  expectNoInternalFields,
  holdOrderUpdatesUntil,
  mockStorageOk,
  seedOrder,
} from "../../helpers/order.js";
import { createTestStore } from "../../helpers/store.js";

vi.mock("../../../src/services/email.js", () => ({ sendCodeEmail: vi.fn() }));
vi.mock("../../../src/services/storage.js", () => ({
  verifyImageObject: vi.fn(),
  createSignedViewUrls: vi.fn(),
}));

const MINUTE_MS = 60_000;
const S = OrderStatus;

let app;
let customer;
let store;
beforeAll(ensureOrderIndexes);
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  mockStorageOk();
  app = createApp();
  customer = await onboardedCustomer(app, "asha@example.com");
  store = await createTestStore();
});
afterEach(() => {
  vi.useRealTimers();
});

const seed = (status, extra = {}) =>
  seedOrder({
    userId: customer.user.id,
    storeId: store.id,
    status,
    ...(status === S.AWAITING_CONFIRMATION && billFields()),
    ...extra,
  });

const confirm = (orderId, body = { billVersion: 1 }, api = customer.api) =>
  api.post(`/orders/${orderId}/confirm`).send(body);

const cancel = (orderId, body = {}, api = customer.api) =>
  api.post(`/orders/${orderId}/cancel`).send(body);

const statusOf = async (orderId) => (await Order.findById(orderId).lean()).status;

const OTHER_STATUSES = (allowed) => Object.values(S).filter((status) => !allowed.includes(status));

describe("POST /orders/:id/confirm", () => {
  it("confirms the bill the customer saw", async () => {
    const order = await seed(S.AWAITING_CONFIRMATION);

    const res = await confirm(order._id);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Order confirmed");
    const view = res.body.data.order;
    expect(view.status).toBe(S.CONFIRMED);
    expect(view.statusHistory.at(-1)).toEqual({
      status: S.CONFIRMED,
      at: NOW.toISOString(),
      by: { kind: HistoryActorKind.CUSTOMER },
      note: null,
    });
    expect(view).not.toHaveProperty("imageUrls");
    expect(createSignedViewUrls).not.toHaveBeenCalled();
    expectNoInternalFields(res.body);

    const stored = await Order.findById(order._id).lean();
    expect(String(stored.statusHistory.at(-1).by.id)).toBe(customer.user.id);
  });

  it("returns 409 BILL_CHANGED for an old bill version", async () => {
    const order = await seed(S.AWAITING_CONFIRMATION, billFields({ version: 2 }));

    expectError(await confirm(order._id, { billVersion: 1 }), 409, ErrorCodes.BILL_CHANGED);
    expect(await statusOf(order._id)).toBe(S.AWAITING_CONFIRMATION);
  });

  it("accepts a confirmation one second before the bill expires", async () => {
    // Sent 59:59 ago: it expires in one second. (Moving the clock would expire the session.)
    const order = await seed(
      S.AWAITING_CONFIRMATION,
      billFields({ sentAt: new Date(NOW.getTime() - 60 * MINUTE_MS + 1000) }),
    );
    expect((await confirm(order._id)).status).toBe(200);
  });

  it.each([
    ["exactly at", 60],
    ["after", 90],
  ])("returns 409 BILL_EXPIRED %s billExpiresAt", async (_case, minutesAgo) => {
    const order = await seed(
      S.AWAITING_CONFIRMATION,
      billFields({ sentAt: new Date(NOW.getTime() - minutesAgo * MINUTE_MS) }),
    );

    expectError(await confirm(order._id), 409, ErrorCodes.BILL_EXPIRED);
    expect(await statusOf(order._id)).toBe(S.AWAITING_CONFIRMATION);
  });

  it.each(OTHER_STATUSES([S.AWAITING_CONFIRMATION]))(
    "returns 409 INVALID_ORDER_TRANSITION from %s",
    async (status) => {
      const order = await seed(status);
      expectError(await confirm(order._id), 409, ErrorCodes.INVALID_ORDER_TRANSITION);
      expect(await statusOf(order._id)).toBe(status);
    },
  );

  it("returns 404 ORDER_NOT_FOUND for another customer's order", async () => {
    const other = await onboardedCustomer(app, "b@example.com");
    const theirs = await seedOrder({
      userId: other.user.id,
      storeId: store.id,
      status: S.AWAITING_CONFIRMATION,
      ...billFields(),
    });

    expectError(await confirm(theirs._id), 404, ErrorCodes.ORDER_NOT_FOUND);
    expect(await statusOf(theirs._id)).toBe(S.AWAITING_CONFIRMATION);
  });

  it("returns 400 INVALID_ID for a malformed id", async () => {
    expectError(await confirm("nope"), 400, ErrorCodes.INVALID_ID);
  });

  it.each([
    ["no billVersion", {}],
    ["billVersion 0", { billVersion: 0 }],
    ["billVersion as a string", { billVersion: "1" }],
    ["a status field", { billVersion: 1, status: S.CONFIRMED }],
    ["a totalPaise field", { billVersion: 1, totalPaise: 1 }],
  ])("rejects %s with 400 VALIDATION_ERROR", async (_case, body) => {
    const order = await seed(S.AWAITING_CONFIRMATION);
    expectError(await confirm(order._id, body), 400, ErrorCodes.VALIDATION_ERROR);
  });
});

describe("POST /orders/:id/cancel", () => {
  it("cancels a PENDING_REVIEW order without a reason", async () => {
    const order = await seed(S.PENDING_REVIEW);

    const res = await cancel(order._id);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Order cancelled");
    expect(res.body.data.order).toMatchObject({
      status: S.CANCELLED,
      cancellation: { byKind: HistoryActorKind.CUSTOMER, code: null, note: null },
    });
    expect(res.body.data.order.statusHistory.at(-1)).toEqual({
      status: S.CANCELLED,
      at: NOW.toISOString(),
      by: { kind: HistoryActorKind.CUSTOMER },
      note: null,
    });
    expectNoInternalFields(res.body);
  });

  it("cancels an AWAITING_CONFIRMATION order with a reason and note", async () => {
    const order = await seed(S.AWAITING_CONFIRMATION);

    const res = await cancel(order._id, {
      reasonCode: CustomerCancelReason.PRICE_TOO_HIGH,
      note: " Cheaper nearby ",
    });

    expect(res.body.data.order.cancellation).toEqual({
      byKind: HistoryActorKind.CUSTOMER,
      code: CustomerCancelReason.PRICE_TOO_HIGH,
      note: "Cheaper nearby",
    });
    expect(res.body.data.order.statusHistory.at(-1).note).toBe("Cheaper nearby");
  });

  it("accepts OTHER with a note", async () => {
    const order = await seed(S.PENDING_REVIEW);
    const res = await cancel(order._id, { reasonCode: "OTHER", note: "Doctor changed it" });
    expect(res.status).toBe(200);
  });

  it.each([
    ["OTHER without a note", { reasonCode: "OTHER" }, "note"],
    ["a note without a reason", { note: "why" }, "reasonCode"],
    ["an unknown reason", { reasonCode: "TOO_SLOW" }, "reasonCode"],
    ["a 301-character note", { reasonCode: "OTHER", note: "x".repeat(301) }, "note"],
    ["a status field", { status: S.CANCELLED }, "status"],
  ])("rejects %s with 400 VALIDATION_ERROR", async (_case, body, field) => {
    const order = await seed(S.PENDING_REVIEW);
    const res = await cancel(order._id, body);

    expectError(res, 400, ErrorCodes.VALIDATION_ERROR);
    expect(res.body.errors.map((error) => error.field)).toContain(field);
    expect(await statusOf(order._id)).toBe(S.PENDING_REVIEW);
  });

  it.each(OTHER_STATUSES([S.PENDING_REVIEW, S.AWAITING_CONFIRMATION]))(
    "returns 409 INVALID_ORDER_TRANSITION from %s",
    async (status) => {
      const order = await seed(status);
      expectError(await cancel(order._id), 409, ErrorCodes.INVALID_ORDER_TRANSITION);
      expect(await statusOf(order._id)).toBe(status);
    },
  );

  it("returns 404 ORDER_NOT_FOUND for another customer's order", async () => {
    const other = await onboardedCustomer(app, "b@example.com");
    const theirs = await seedOrder({ userId: other.user.id, storeId: store.id });

    expectError(await cancel(theirs._id), 404, ErrorCodes.ORDER_NOT_FOUND);
    expect(await statusOf(theirs._id)).toBe(S.PENDING_REVIEW);
  });
});

describe("concurrent customer actions", () => {
  it("lets one of a simultaneous confirm and cancel win; the other gets ORDER_STATUS_CHANGED", async () => {
    const order = await seed(S.AWAITING_CONFIRMATION);
    const spy = holdOrderUpdatesUntil(2);
    try {
      const results = await Promise.all([confirm(order._id), cancel(order._id)]);
      const winner = results.find((res) => res.status === 200);
      const loser = results.find((res) => res.status !== 200);

      expect(winner).toBeDefined();
      expectError(loser, 409, ErrorCodes.ORDER_STATUS_CHANGED);
      expect(await statusOf(order._id)).toBe(winner.body.data.order.status);
      expect((await Order.findById(order._id).lean()).statusHistory).toHaveLength(3);
    } finally {
      spy.mockRestore();
    }
  });
});
