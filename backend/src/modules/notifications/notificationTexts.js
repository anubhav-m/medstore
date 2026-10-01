import { NotificationEvent } from "@medstore/shared";
import { formatRupees } from "../../utils/money.js";
import { istTimeString } from "../../utils/time.js";

// Lock-screen text (backend 9): the order number, a status sentence and at most the total and
// the confirm-by time. Never items, patient names, notes or addresses.

const E = NotificationEvent;

const text = (title, body) => ({ title, body });
const total = (order) => formatRupees(order.totalPaise);
const confirmBy = (order) => istTimeString(order.billExpiresAt);

// Per event, a text builder for each audience that hears about it.
export const NOTIFICATION_TEXTS = {
  [E.ORDER_PLACED]: {
    admins: (o) => text(`New order ${o.orderNumber}`, "Tap to review the prescription."),
  },
  [E.BILL_SENT]: {
    customer: (o) =>
      text(
        "Your bill is ready",
        `${o.orderNumber} · ${total(o)}. Please confirm by ${confirmBy(o)}.`,
      ),
  },
  [E.BILL_REVISED]: {
    customer: (o) =>
      text(
        "Your bill was updated",
        `${o.orderNumber} · ${total(o)}. Please review and confirm by ${confirmBy(o)}.`,
      ),
  },
  [E.ORDER_REJECTED]: {
    customer: (o) => text(`Order ${o.orderNumber} couldn't be accepted`, "Tap to see why."),
  },
  [E.CANCELLED_BY_STORE]: {
    customer: (o) => text(`Order ${o.orderNumber} was cancelled by the store`, "Tap for details."),
  },
  [E.OUT_FOR_DELIVERY]: {
    customer: (o) => text("Your order is on the way", `${o.orderNumber} · keep ${total(o)} ready.`),
  },
  [E.DELIVERED]: {
    customer: (o) => text(`Order ${o.orderNumber} delivered`, "Thank you for ordering with us."),
  },
  [E.DELIVERY_FAILED]: {
    customer: (o) => text(`We couldn't deliver order ${o.orderNumber}`, "Tap for details."),
  },
  [E.BILL_EXPIRED]: {
    customer: (o) =>
      text(`Order ${o.orderNumber} was cancelled`, "The bill wasn't confirmed in time."),
    admins: (o) => text(`${o.orderNumber} expired`, "The customer didn't confirm the bill."),
  },
  [E.CUSTOMER_CONFIRMED]: {
    admins: (o) => text(`${o.orderNumber} confirmed`, "Ready to pack."),
  },
  [E.CUSTOMER_CANCELLED]: {
    admins: (o) => text(`${o.orderNumber} cancelled by the customer`, "No action needed."),
  },
};
