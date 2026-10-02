import { OrderStatus } from "./orderStatus.js";
import type {
  DeliveryFailedReason,
  HistoryActorKind,
  OrderBill,
  OrderCancellation,
  OrderDeliveryAddress,
  OrderReason,
  PAYMENT_METHOD_COD,
  PaymentStatus,
  RejectReason,
  StaffCancelReason,
} from "./orders.js";
import type { StoreSummary } from "./stores.js";

export const AdminOrderTab = {
  NEW: "NEW",
  AWAITING_CUSTOMER: "AWAITING_CUSTOMER",
  PREPARING: "PREPARING",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
  CLOSED: "CLOSED",
} as const;

export type AdminOrderTab = (typeof AdminOrderTab)[keyof typeof AdminOrderTab];

export const AdminOrderSort = {
  OLDEST_FIRST: "OLDEST_FIRST",
  NEWEST_FIRST: "NEWEST_FIRST",
  /** `billExpiresAt` soonest first */
  BILL_EXPIRES_FIRST: "BILL_EXPIRES_FIRST",
} as const;

export type AdminOrderSort = (typeof AdminOrderSort)[keyof typeof AdminOrderSort];

export interface AdminOrderTabDefinition {
  tab: AdminOrderTab;
  statuses: readonly OrderStatus[];
  sort: AdminOrderSort;
}

const S = OrderStatus;

/** In display order; every status is in exactly one tab. Oldest and newest are by `createdAt`. */
export const ADMIN_ORDER_TABS: readonly AdminOrderTabDefinition[] = [
  { tab: AdminOrderTab.NEW, statuses: [S.PENDING_REVIEW], sort: AdminOrderSort.OLDEST_FIRST },
  {
    tab: AdminOrderTab.AWAITING_CUSTOMER,
    statuses: [S.AWAITING_CONFIRMATION],
    sort: AdminOrderSort.BILL_EXPIRES_FIRST,
  },
  {
    tab: AdminOrderTab.PREPARING,
    statuses: [S.CONFIRMED, S.PACKED],
    sort: AdminOrderSort.OLDEST_FIRST,
  },
  {
    tab: AdminOrderTab.OUT_FOR_DELIVERY,
    statuses: [S.OUT_FOR_DELIVERY],
    sort: AdminOrderSort.OLDEST_FIRST,
  },
  { tab: AdminOrderTab.DELIVERED, statuses: [S.DELIVERED], sort: AdminOrderSort.NEWEST_FIRST },
  {
    tab: AdminOrderTab.CLOSED,
    statuses: [S.REJECTED, S.CANCELLED, S.DELIVERY_FAILED],
    sort: AdminOrderSort.NEWEST_FIRST,
  },
];

/**
 * GET /admin/orders. `storeId` must be one of the admin's stores. Without `tab`, every status is
 * listed newest first. `q` (1–50 chars) is an order-number prefix (`ST01-00`), or a phone: a
 * complete number in any accepted format matches exactly, fewer digits match the start of the
 * 10-digit number.
 */
export interface AdminOrderListQuery {
  storeId?: string;
  tab?: AdminOrderTab;
  q?: string;
  page?: number;
  limit?: number;
}

/** GET /admin/orders/counts. */
export interface AdminOrderCountsQuery {
  storeId?: string;
}

/** An item of GET /admin/orders (no image URLs). */
export interface AdminOrderSummary {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  store: StoreSummary;
  patientName: string;
  customerName: string;
  /** `null` until the first bill */
  totalPaise: number | null;
  /** ISO 8601; `null` until the first bill */
  billExpiresAt: string | null;
  /** ISO 8601 */
  createdAt: string;
}

/** `data` of GET /admin/orders (paginated). */
export interface AdminOrdersResponse {
  orders: AdminOrderSummary[];
}

/** `data` of GET /admin/orders/counts: orders per tab across the admin's stores (or `storeId`). */
export interface AdminOrderCountsResponse {
  counts: Record<AdminOrderTab, number>;
}

export interface AdminOrderStatusEntry {
  status: OrderStatus;
  /** ISO 8601 */
  at: string;
  /** `id` is the customer's or admin's id (`null` for SYSTEM); `name` is set for admins only. */
  by: { kind: HistoryActorKind; id: string | null; name: string | null };
  note: string | null;
}

/** Copied into the order when it was placed, so it outlives the customer's account. */
export interface AdminOrderCustomer {
  id: string;
  name: string;
  phone: string;
  /** The customer has deleted their account */
  isDeleted: boolean;
}

export interface AdminOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  store: StoreSummary;
  customer: AdminOrderCustomer;
  patientName: string;
  customerNote: string | null;
  deliveryAddress: OrderDeliveryAddress;
  /** Straight-line distance from the address pin to the store, one decimal */
  distanceKm: number;
  /** `null` until the first bill */
  bill: OrderBill | null;
  paymentMethod: typeof PAYMENT_METHOD_COD;
  paymentStatus: PaymentStatus;
  cashCollectedPaise: number | null;
  /** ISO 8601 */
  deliveredAt: string | null;
  rejection: OrderReason | null;
  cancellation: OrderCancellation | null;
  deliveryFailure: OrderReason | null;
  statusHistory: AdminOrderStatusEntry[];
  /** The order this one reordered */
  reorderedFrom: string | null;
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601 */
  updatedAt: string;
}

/** GET /admin/orders/:id only: signed prescription photo URLs, valid for `SIGNED_VIEW_URL_TTL_SECONDS`. */
export interface AdminOrderDetail extends AdminOrder {
  imageUrls: string[];
}

/** `data` of GET /admin/orders/:id. */
export interface AdminOrderDetailResponse {
  order: AdminOrderDetail;
}

/** `data` of every admin order action (reject, bill, pack, dispatch, deliver, fail, cancel). */
export interface AdminOrderResponse {
  order: AdminOrder;
}

/** A note (≤ 300 chars) is required when `reasonCode` is `OTHER`. */
export interface RejectOrderRequest {
  reasonCode: RejectReason;
  note?: string;
}

/** A note (≤ 300 chars) is required when `reasonCode` is `OTHER`. */
export interface StaffCancelOrderRequest {
  reasonCode: StaffCancelReason;
  note?: string;
}

/** A note (≤ 300 chars) is required when `reasonCode` is `OTHER`. */
export interface FailDeliveryRequest {
  reasonCode: DeliveryFailedReason;
  note?: string;
}

export interface BillItemInput {
  /** 2–100 chars */
  name: string;
  /** Integer 1–999 */
  quantity: number;
  /** Integer 1–10,000,000 */
  unitPricePaise: number;
}

/**
 * POST /admin/orders/:id/bill. `expectedBillVersion` is the version on screen: 0 sends the first
 * bill, the current version revises it. The server computes every total; totals sent here are
 * rejected. `deliveryFeePaise` (0–100,000) defaults to the order's current fee; `discountPaise`
 * (0–subtotal) to 0.
 */
export interface SendBillRequest {
  expectedBillVersion: number;
  /** 1–50 items */
  items: BillItemInput[];
  deliveryFeePaise?: number;
  discountPaise?: number;
}

/** Recorded as given (an integer from 0 to `CASH_COLLECTED_MAX_PAISE`); it may differ from the total. */
export interface DeliverOrderRequest {
  cashCollectedPaise: number;
}

/** GET /admin/item-suggestions. `q`: 1–50 chars, matched case-insensitively as a prefix. */
export interface ItemSuggestionsQuery {
  storeId: string;
  q: string;
}

/** `data` of GET /admin/item-suggestions: distinct names previously billed at the store, ≤ 10. */
export interface ItemSuggestionsResponse {
  suggestions: string[];
}
