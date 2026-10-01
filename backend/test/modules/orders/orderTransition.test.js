import {
  ErrorCodes,
  HistoryActorKind,
  ORDER_TRANSITIONS,
  OrderAction,
  OrderStatus,
  TransitionActor,
} from "@medstore/shared";
import mongoose from "mongoose";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Order } from "../../../src/modules/orders/order.model.js";
import { transitionOrder } from "../../../src/modules/orders/orderTransition.js";
import {
  NOW,
  billFields,
  ensureOrderIndexes,
  holdOrderUpdatesUntil,
  seedOrder,
} from "../../helpers/order.js";

const userId = new mongoose.Types.ObjectId();
const storeId = new mongoose.Types.ObjectId();
const adminId = new mongoose.Types.ObjectId();

// Every order carries a live bill, so CONFIRM can succeed from AWAITING_CONFIRMATION.
const seed = (status) => seedOrder({ userId, storeId, status, ...billFields() });

const BY = {
  [TransitionActor.CUSTOMER]: { kind: HistoryActorKind.CUSTOMER, id: userId },
  [TransitionActor.STAFF]: { kind: HistoryActorKind.ADMIN, id: adminId },
  [TransitionActor.SYSTEM]: { kind: HistoryActorKind.SYSTEM },
};

const rejects = (promise, code) => expect(promise).rejects.toMatchObject({ code });

beforeAll(ensureOrderIndexes);
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

const cases = ORDER_TRANSITIONS.flatMap((transition) =>
  Object.values(OrderStatus).map((status) => [
    transition.action,
    status,
    transition.from.includes(status),
    transition,
  ]),
);

describe("transitionOrder — the table", () => {
  it.each(cases)("%s from %s → allowed: %s", async (action, status, allowed, transition) => {
    const order = await seed(status);
    const by = BY[transition.actor];
    const attempt = transitionOrder({ orderId: order._id, action, by, note: "n" });

    if (!allowed) {
      await rejects(attempt, ErrorCodes.INVALID_ORDER_TRANSITION);
      expect((await Order.findById(order._id).lean()).status).toBe(status);
      return;
    }
    const updated = await attempt;
    expect(updated.status).toBe(transition.to);
    expect(updated.statusHistory.at(-1)).toEqual({
      status: transition.to,
      at: NOW,
      by: { kind: by.kind, id: by.id ?? null },
      note: "n",
    });
  });

  it.each(
    ORDER_TRANSITIONS.flatMap((transition) =>
      Object.values(TransitionActor)
        .filter((actor) => actor !== transition.actor)
        .map((actor) => [transition.action, actor, transition]),
    ),
  )("%s by %s → INVALID_ORDER_TRANSITION", async (action, actor, transition) => {
    const order = await seed(transition.from[0]);
    await rejects(
      transitionOrder({ orderId: order._id, action, by: BY[actor] }),
      ErrorCodes.INVALID_ORDER_TRANSITION,
    );
    expect((await Order.findById(order._id).lean()).status).toBe(transition.from[0]);
  });

  it("refuses an unknown action", async () => {
    const order = await seed(OrderStatus.PENDING_REVIEW);
    await rejects(
      transitionOrder({ orderId: order._id, action: "SHIP", by: BY.STAFF }),
      ErrorCodes.INVALID_ORDER_TRANSITION,
    );
  });
});

describe("transitionOrder — matching", () => {
  it("writes `set` together with the status", async () => {
    const order = await seed(OrderStatus.PENDING_REVIEW);
    const updated = await transitionOrder({
      orderId: order._id,
      action: OrderAction.REJECT,
      by: BY.STAFF,
      set: { rejection: { code: "PRESCRIPTION_UNCLEAR", note: null } },
    });
    expect(updated.rejection).toEqual({ code: "PRESCRIPTION_UNCLEAR", note: null });
  });

  it("returns ORDER_NOT_FOUND for an order outside the scope", async () => {
    const order = await seed(OrderStatus.PENDING_REVIEW);
    await rejects(
      transitionOrder({
        orderId: order._id,
        action: OrderAction.CUSTOMER_CANCEL,
        by: BY.CUSTOMER,
        scope: { userId: new mongoose.Types.ObjectId() },
      }),
      ErrorCodes.ORDER_NOT_FOUND,
    );
  });

  it("returns BILL_CHANGED when the expected bill version moved", async () => {
    const order = await seed(OrderStatus.AWAITING_CONFIRMATION);
    await rejects(
      transitionOrder({
        orderId: order._id,
        action: OrderAction.REVISE_BILL,
        by: BY.STAFF,
        billVersion: 2,
      }),
      ErrorCodes.BILL_CHANGED,
    );
  });

  it("returns BILL_EXPIRED when confirming at billExpiresAt", async () => {
    const order = await seed(OrderStatus.AWAITING_CONFIRMATION);
    await rejects(
      transitionOrder({
        orderId: order._id,
        action: OrderAction.CONFIRM,
        by: BY.CUSTOMER,
        billVersion: 1,
        now: order.billExpiresAt,
      }),
      ErrorCodes.BILL_EXPIRED,
    );
  });

  it("lets exactly one of two simultaneous identical transitions win", async () => {
    const order = await seed(OrderStatus.CONFIRMED);
    const spy = holdOrderUpdatesUntil(2);
    try {
      const pack = () =>
        transitionOrder({ orderId: order._id, action: OrderAction.PACK, by: BY.STAFF });
      const results = await Promise.allSettled([pack(), pack()]);

      expect(results.map((result) => result.status).sort()).toEqual(["fulfilled", "rejected"]);
      const failure = results.find((result) => result.status === "rejected");
      expect(failure.reason.code).toBe(ErrorCodes.ORDER_STATUS_CHANGED);
      const stored = await Order.findById(order._id).lean();
      expect(
        stored.statusHistory.filter((entry) => entry.status === OrderStatus.PACKED),
      ).toHaveLength(1);
    } finally {
      spy.mockRestore();
    }
  });
});
