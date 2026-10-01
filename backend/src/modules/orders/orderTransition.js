import {
  ErrorCodes,
  HistoryActorKind,
  ORDER_TRANSITIONS,
  OrderAction,
  TransitionActor,
} from "@medstore/shared";
import { AppError } from "../../utils/AppError.js";
import { notifyTransition } from "../notifications/orderNotifications.js";
import { Order } from "./order.model.js";

// The table names who may act; the history records which kind of account did.
const KIND_FOR_ACTOR = {
  [TransitionActor.CUSTOMER]: HistoryActorKind.CUSTOMER,
  [TransitionActor.STAFF]: HistoryActorKind.ADMIN,
  [TransitionActor.SYSTEM]: HistoryActorKind.SYSTEM,
};

export const orderNotFound = () => new AppError("Order not found", 404, ErrorCodes.ORDER_NOT_FOUND);

const invalidTransition = () =>
  new AppError(
    "This order can't be changed that way now",
    409,
    ErrorCodes.INVALID_ORDER_TRANSITION,
  );

const conflict = (message, code) => new AppError(message, 409, code);

// A confirmation counts only before the bill expires.
const needsLiveBill = (action) => action === OrderAction.CONFIRM;

// The conditional update matched nothing, so something changed after the order was read.
const classifyMiss = async ({ orderId, action, scope, billVersion, now }, readStatus) => {
  const order = await Order.findOne(
    { _id: orderId, ...scope },
    { status: 1, billVersion: 1, billExpiresAt: 1 },
  ).lean();
  if (!order) throw orderNotFound();
  if (order.status !== readStatus) {
    throw conflict("This order was just updated. Please refresh.", ErrorCodes.ORDER_STATUS_CHANGED);
  }
  if (billVersion !== undefined && order.billVersion !== billVersion) {
    throw conflict("The bill was updated. Please review it again.", ErrorCodes.BILL_CHANGED);
  }
  if (needsLiveBill(action) && !(order.billExpiresAt > now)) {
    throw conflict("This bill has expired", ErrorCodes.BILL_EXPIRED);
  }
  throw conflict("This order was just updated. Please refresh.", ErrorCodes.ORDER_STATUS_CHANGED);
};

/**
 * The only way an order's status changes — customer, admin and system actions all call it.
 *
 * - `action`: an `OrderAction`; it must be in `ORDER_TRANSITIONS` for the actor and current status.
 * - `by`: `{ kind: HistoryActorKind, id? }` (SYSTEM has no id).
 * - `scope`: who may see the order, e.g. `{ userId }` or `{ storeId: { $in: ids } }`; an order
 *   outside it is ORDER_NOT_FOUND.
 * - `billVersion`: the bill version the actor saw; a different one is BILL_CHANGED.
 * - `set`: fields written together with the status (cancellation, bill, deliveredAt, …).
 * - `note`: stored on the statusHistory entry.
 *
 * One conditional update on the status that was read (plus the bill version and expiry when they
 * apply), so concurrent actions produce exactly one winner. Returns the updated order (lean).
 * The winner's push notification (root 3.6) starts after the write, without being awaited.
 */
export const transitionOrder = async ({
  orderId,
  action,
  by,
  scope = {},
  billVersion,
  set = {},
  note = null,
  now = new Date(),
}) => {
  const transition = ORDER_TRANSITIONS.find((candidate) => candidate.action === action);
  if (!transition || KIND_FOR_ACTOR[transition.actor] !== by.kind) throw invalidTransition();

  const current = await Order.findOne({ _id: orderId, ...scope }, { status: 1 }).lean();
  if (!current) throw orderNotFound();
  if (!transition.from.includes(current.status)) throw invalidTransition();

  const updated = await Order.findOneAndUpdate(
    {
      _id: orderId,
      ...scope,
      status: current.status,
      ...(billVersion !== undefined && { billVersion }),
      ...(needsLiveBill(action) && { billExpiresAt: { $gt: now } }),
    },
    {
      $set: { ...set, status: transition.to },
      $push: {
        statusHistory: {
          status: transition.to,
          at: now,
          by: { kind: by.kind, id: by.id ?? null },
          note,
        },
      },
    },
    { returnDocument: "after", runValidators: true },
  ).lean();
  if (updated) {
    notifyTransition(updated, action);
    return updated;
  }
  return classifyMiss({ orderId, action, scope, billVersion, now }, current.status);
};
