import { OrderStatus } from "@medstore/shared";
import type { ColorFamily } from "../../theme/colors";
import type { AppKind } from "../../theme/density";
import type { IconName } from "../Icon";

interface StatusDisplay {
  family: ColorFamily;
  /** Only where staff see a different family from customers. */
  staffFamily?: ColorFamily;
  icon: IconName;
  customerLabel: string;
  staffLabel: string;
}

/** How each status from @medstore/shared looks. Typed as a full Record so no status can be missed. */
export const orderStatusDisplay: Record<OrderStatus, StatusDisplay> = {
  [OrderStatus.PENDING_REVIEW]: {
    family: "slate",
    icon: "file-search-outline",
    customerLabel: "Being checked",
    staffLabel: "New",
  },
  [OrderStatus.AWAITING_CONFIRMATION]: {
    family: "haldi",
    // Haldi means "your move". Staff are waiting on the customer here, so they see slate.
    staffFamily: "slate",
    icon: "receipt-text-clock-outline",
    customerLabel: "Confirm your bill",
    staffLabel: "Awaiting customer",
  },
  [OrderStatus.CONFIRMED]: {
    family: "indigo",
    icon: "receipt-text-check-outline",
    customerLabel: "Confirmed",
    staffLabel: "Confirmed",
  },
  [OrderStatus.PACKED]: {
    family: "indigo",
    icon: "package-variant-closed",
    customerLabel: "Packed",
    staffLabel: "Packed",
  },
  [OrderStatus.OUT_FOR_DELIVERY]: {
    family: "teal",
    icon: "moped-outline",
    customerLabel: "On the way",
    staffLabel: "Out for delivery",
  },
  [OrderStatus.DELIVERED]: {
    family: "green",
    icon: "check-decagram-outline",
    customerLabel: "Delivered",
    staffLabel: "Delivered",
  },
  [OrderStatus.DELIVERY_FAILED]: {
    family: "brick",
    icon: "map-marker-alert-outline",
    customerLabel: "Couldn't deliver",
    staffLabel: "Delivery failed",
  },
  [OrderStatus.REJECTED]: {
    family: "brick",
    icon: "file-cancel-outline",
    customerLabel: "Not accepted",
    staffLabel: "Rejected",
  },
  [OrderStatus.CANCELLED]: {
    family: "grey",
    icon: "close-circle-outline",
    customerLabel: "Cancelled",
    staffLabel: "Cancelled",
  },
};

// A status added on the server after this build shipped: neutral grey, never a crash.
const UNKNOWN_STATUS: StatusDisplay = {
  family: "grey",
  icon: "help-circle-outline",
  customerLabel: "Status not available",
  staffLabel: "Unknown status",
};

/** The display for a status, or a neutral fallback for one this build of the app doesn't know. */
export function statusDisplay(status: OrderStatus): StatusDisplay {
  return Object.hasOwn(orderStatusDisplay, status) ? orderStatusDisplay[status] : UNKNOWN_STATUS;
}

/** The family and label a status shows in this app: customer wording, or staff wording. */
export function statusLook(
  status: OrderStatus,
  app: AppKind,
): { family: ColorFamily; label: string } {
  const display = statusDisplay(status);
  return app === "customer"
    ? { family: display.family, label: display.customerLabel }
    : { family: display.staffFamily ?? display.family, label: display.staffLabel };
}
