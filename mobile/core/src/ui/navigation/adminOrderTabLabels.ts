import { AdminOrderTab } from "@medstore/shared";

/** Display labels for ADMIN_ORDER_TABS in @medstore/shared. */
export const adminOrderTabLabels: Record<AdminOrderTab, string> = {
  [AdminOrderTab.NEW]: "New",
  [AdminOrderTab.AWAITING_CUSTOMER]: "Awaiting customer",
  [AdminOrderTab.PREPARING]: "Preparing",
  [AdminOrderTab.OUT_FOR_DELIVERY]: "Out for delivery",
  [AdminOrderTab.DELIVERED]: "Delivered",
  [AdminOrderTab.CLOSED]: "Closed",
};
