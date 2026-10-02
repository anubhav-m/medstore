import { OrderStatus } from "@medstore/shared";

/** Values a next-step line can mention, already formatted (formatDateTime / formatCurrency). */
export interface NextStepDetails {
  /** "4:30 PM": when the bill must be confirmed by. */
  confirmBy?: string;
  /** "₹1,250.00": the cash to keep ready. */
  total?: string;
  /** "Today, 4:30 PM". */
  deliveredAt?: string;
}

/**
 * The customer's "what happens next" line under a status mark (DESIGN.md). Parts that need a value
 * fall back to a plain sentence when the value isn't given.
 */
export function orderStatusNextStep(status: OrderStatus, details: NextStepDetails = {}): string {
  switch (status) {
    case OrderStatus.PENDING_REVIEW:
      return "A pharmacist is checking your photos. You'll get a bill here.";
    case OrderStatus.AWAITING_CONFIRMATION:
      return details.confirmBy
        ? `Check the bill and confirm by ${details.confirmBy}. If you don't, the order is cancelled.`
        : "Check the bill and confirm it. If you don't, the order is cancelled.";
    case OrderStatus.CONFIRMED:
      return "The store is getting your medicines ready.";
    case OrderStatus.PACKED:
      return "Your order is packed. It goes out for delivery next.";
    case OrderStatus.OUT_FOR_DELIVERY:
      return details.total
        ? `Keep ${details.total} ready in cash.`
        : "Keep the bill amount ready in cash.";
    case OrderStatus.DELIVERED:
      // The mark already says "Delivered", so this line gives only the when.
      return details.deliveredAt
        ? `Handed over: ${details.deliveredAt}.`
        : "Your order was handed over.";
    case OrderStatus.DELIVERY_FAILED:
      return "The store couldn't deliver this order. The reason is below.";
    case OrderStatus.REJECTED:
      return "The pharmacist couldn't accept this order. The reason is below.";
    case OrderStatus.CANCELLED:
      return "This order was cancelled. The reason is below.";
    default:
      // A status added after this build: say nothing rather than guess.
      return "";
  }
}
