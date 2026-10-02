import {
  CustomerCancelReason,
  DeliveryFailedReason,
  RejectReason,
  StaffCancelReason,
  SystemCancelReason,
} from "@medstore/shared";

// Display labels for the reason codes in @medstore/shared. Full Records, so a new code fails the
// typecheck until it has a label here.

export const rejectReasonLabels: Record<RejectReason, string> = {
  [RejectReason.PRESCRIPTION_UNCLEAR]: "The prescription photo isn't clear",
  [RejectReason.PRESCRIPTION_EXPIRED]: "The prescription has expired",
  [RejectReason.PRESCRIPTION_REQUIRED]: "A prescription is needed for this medicine",
  [RejectReason.MEDICINE_UNAVAILABLE]: "The medicine isn't available",
  [RejectReason.OTHER]: "Other reason",
};

export const customerCancelReasonLabels: Record<CustomerCancelReason, string> = {
  [CustomerCancelReason.CHANGED_MIND]: "I changed my mind",
  [CustomerCancelReason.PRICE_TOO_HIGH]: "The price is too high",
  [CustomerCancelReason.ORDERED_BY_MISTAKE]: "I ordered by mistake",
  [CustomerCancelReason.BOUGHT_ELSEWHERE]: "I bought it somewhere else",
  [CustomerCancelReason.OTHER]: "Other reason",
};

export const staffCancelReasonLabels: Record<StaffCancelReason, string> = {
  [StaffCancelReason.CUSTOMER_REQUESTED]: "The customer asked to cancel",
  [StaffCancelReason.MEDICINE_UNAVAILABLE]: "The medicine isn't available",
  [StaffCancelReason.UNABLE_TO_DELIVER]: "We can't deliver this order",
  [StaffCancelReason.OTHER]: "Other reason",
};

export const deliveryFailedReasonLabels: Record<DeliveryFailedReason, string> = {
  [DeliveryFailedReason.CUSTOMER_UNREACHABLE]: "Couldn't reach the customer",
  [DeliveryFailedReason.CUSTOMER_REFUSED]: "The customer refused the order",
  [DeliveryFailedReason.WRONG_ADDRESS]: "The address was wrong",
  [DeliveryFailedReason.OTHER]: "Other reason",
};

export const systemCancelReasonLabels: Record<SystemCancelReason, string> = {
  [SystemCancelReason.BILL_EXPIRED]: "The bill wasn't confirmed in time",
};
