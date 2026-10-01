import { env } from "../../config/env.js";
import { addMinutes, istDayStart } from "../../utils/time.js";

// Money is integer paise; every total is computed here and never taken from a client (root 3.4).

export const subtotalOf = (items) =>
  items.reduce((sum, { quantity, unitPricePaise }) => sum + quantity * unitPricePaise, 0);

// The bill fields stored on the order. `nameKey` feeds item suggestions.
export const computeBill = ({ items, deliveryFeePaise, discountPaise }) => {
  const subtotalPaise = subtotalOf(items);
  return {
    items: items.map(({ name, quantity, unitPricePaise }) => ({
      name,
      nameKey: name.toLowerCase(),
      quantity,
      unitPricePaise,
      lineTotalPaise: quantity * unitPricePaise,
    })),
    subtotalPaise,
    deliveryFeePaise,
    discountPaise,
    totalPaise: subtotalPaise + deliveryFeePaise - discountPaise,
  };
};

// The timeout after `sentAt`, but no later than the store's closing time that IST day when the
// bill goes out before closing. A bill sent after closing gets the full timeout.
export const billExpiresAt = (store, sentAt) => {
  const timeoutAt = addMinutes(sentAt, env.BILL_CONFIRMATION_TIMEOUT_MINUTES);
  const closesAt = addMinutes(istDayStart(sentAt), store.closingMinutes);
  return sentAt < closesAt && closesAt < timeoutAt ? closesAt : timeoutAt;
};
