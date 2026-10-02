import {
  ErrorCodes,
  HistoryActorKind,
  OrderAction,
  OrderStatus,
  SystemCancelReason,
} from "@medstore/shared";
import { logger } from "../config/logger.js";
import { Order } from "../modules/orders/order.model.js";
import { transitionOrder } from "../modules/orders/orderTransition.js";
import { skipWhileRunning, startJob } from "./schedule.js";

const BILL_EXPIRY_INTERVAL_MS = 5 * 60 * 1000;
// Bounds one run; anything left over is picked up by the next tick.
const BATCH_SIZE = 100;
const HISTORY_NOTE = "Bill not confirmed in time";

// The order was confirmed, cancelled or re-billed after the query read it — not a failure.
const CHANGED_MEANWHILE = new Set([
  ErrorCodes.INVALID_ORDER_TRANSITION,
  ErrorCodes.ORDER_STATUS_CHANGED,
  ErrorCodes.BILL_CHANGED,
]);

const expireOne = ({ _id, billVersion }, now) =>
  transitionOrder({
    orderId: _id,
    action: OrderAction.EXPIRE_BILL,
    by: { kind: HistoryActorKind.SYSTEM },
    // A revision restarts the expiry, so only the bill version that was read may be cancelled.
    billVersion,
    set: {
      cancellation: {
        byKind: HistoryActorKind.SYSTEM,
        code: SystemCancelReason.BILL_EXPIRED,
        note: null,
      },
    },
    note: HISTORY_NOTE,
    now,
  });

/**
 * Cancels up to one batch of AWAITING_CONFIRMATION orders whose `billExpiresAt` has passed,
 * earliest expiry first. Each goes through `transitionOrder`, whose conditional update makes
 * concurrent runs safe and sends the root 3.6 notifications. One order failing never stops the rest.
 */
export const expireUnconfirmedBills = async (now = new Date()) => {
  const orders = await Order.find(
    { status: OrderStatus.AWAITING_CONFIRMATION, billExpiresAt: { $lte: now } },
    { billVersion: 1 },
  )
    .sort({ billExpiresAt: 1 })
    .limit(BATCH_SIZE)
    .lean();

  const result = { expired: 0, skipped: 0, failed: 0 };
  for (const order of orders) {
    try {
      await expireOne(order, now);
      result.expired += 1;
    } catch (error) {
      if (CHANGED_MEANWHILE.has(error.code)) {
        result.skipped += 1;
      } else {
        result.failed += 1;
        logger.error({ err: error, orderId: String(order._id) }, "bill expiry failed");
      }
    }
  }
  if (orders.length > 0) logger.info(result, "bill expiry run finished");
  return result;
};

// A tick that fires while the previous run is still going is skipped (returns null).
export const runScheduledBillExpiry = skipWhileRunning(expireUnconfirmedBills);

export const startBillExpiryJob = () =>
  startJob("bill expiry", runScheduledBillExpiry, BILL_EXPIRY_INTERVAL_MS);
