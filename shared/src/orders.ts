import type { OrderStatus } from "./orderStatus.js";

/** Required (a UUID) on POST /orders and POST /orders/:id/reorder. A retry reuses it. */
export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";

/** Who made a status change. Customers never see an admin's id. */
export const HistoryActorKind = {
  CUSTOMER: "CUSTOMER",
  ADMIN: "ADMIN",
  SYSTEM: "SYSTEM",
} as const;

export type HistoryActorKind = (typeof HistoryActorKind)[keyof typeof HistoryActorKind];

/** A note is required with `OTHER`. */
export const CustomerCancelReason = {
  CHANGED_MIND: "CHANGED_MIND",
  PRICE_TOO_HIGH: "PRICE_TOO_HIGH",
  ORDERED_BY_MISTAKE: "ORDERED_BY_MISTAKE",
  BOUGHT_ELSEWHERE: "BOUGHT_ELSEWHERE",
  OTHER: "OTHER",
} as const;

export type CustomerCancelReason = (typeof CustomerCancelReason)[keyof typeof CustomerCancelReason];

/** Cash on delivery is the only payment method. */
export const PAYMENT_METHOD_COD = "COD";

export const PaymentStatus = {
  PENDING: "PENDING",
  COLLECTED: "COLLECTED",
} as const;

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

/** `active`: non-terminal orders; `past`: terminal ones. Leaving it out lists both. */
export const OrderListScope = {
  ACTIVE: "active",
  PAST: "past",
} as const;

export type OrderListScope = (typeof OrderListScope)[keyof typeof OrderListScope];

export interface CreateOrderRequest {
  storeId: string;
  addressId: string;
  /** 1–5 distinct paths returned by POST /uploads/prescriptions, already uploaded */
  imagePaths: string[];
  /** Defaults to the customer's name */
  patientName?: string;
  note?: string;
}

/** Reorders a DELIVERED order at the same store; the old note is not copied. */
export interface ReorderRequest {
  note?: string;
}

export interface ConfirmOrderRequest {
  /** The bill version the customer was shown */
  billVersion: number;
}

/** `note` needs a `reasonCode`, and is required when it is `OTHER`. */
export interface CancelOrderRequest {
  reasonCode?: CustomerCancelReason;
  note?: string;
}

export interface OrderListQuery {
  scope?: OrderListScope;
  page?: number;
  limit?: number;
}

export interface OrderStoreSummary {
  id: string;
  name: string;
}

export interface OrderStore extends OrderStoreSummary {
  phone: string;
}

/** A copy taken when the order was placed; editing the saved address doesn't change it. */
export interface OrderDeliveryAddress {
  label: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  pincode: string;
  lat: number;
  lng: number;
}

export interface OrderBillItem {
  name: string;
  quantity: number;
  unitPricePaise: number;
  lineTotalPaise: number;
}

export interface OrderBill {
  /** Send this back when confirming */
  version: number;
  items: OrderBillItem[];
  subtotalPaise: number;
  deliveryFeePaise: number;
  discountPaise: number;
  totalPaise: number;
  /** ISO 8601 */
  sentAt: string;
  /** ISO 8601; confirm before this */
  expiresAt: string;
}

export interface OrderReason {
  code: string;
  note: string | null;
}

export interface OrderCancellation {
  byKind: HistoryActorKind;
  /** `null` when a customer cancelled without giving a reason */
  code: string | null;
  note: string | null;
}

export interface CustomerOrderStatusEntry {
  status: OrderStatus;
  /** ISO 8601 */
  at: string;
  by: { kind: HistoryActorKind };
  note: string | null;
}

/** An item of GET /orders. */
export interface CustomerOrderSummary {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  store: OrderStoreSummary;
  patientName: string;
  /** `null` until the first bill */
  totalPaise: number | null;
  /** ISO 8601 */
  createdAt: string;
}

export interface CustomerOrder extends Omit<CustomerOrderSummary, "store"> {
  store: OrderStore;
  customerNote: string | null;
  deliveryAddress: OrderDeliveryAddress;
  /** Straight-line distance from the address pin to the store, one decimal */
  distanceKm: number;
  /** `null` until the store sends a bill */
  bill: OrderBill | null;
  paymentMethod: typeof PAYMENT_METHOD_COD;
  paymentStatus: PaymentStatus;
  cashCollectedPaise: number | null;
  /** ISO 8601 */
  deliveredAt: string | null;
  rejection: OrderReason | null;
  cancellation: OrderCancellation | null;
  deliveryFailure: OrderReason | null;
  statusHistory: CustomerOrderStatusEntry[];
  /** The order this one reordered */
  reorderedFrom: string | null;
  /** ISO 8601 */
  updatedAt: string;
}

/** GET /orders/:id only: signed prescription photo URLs, valid for `SIGNED_VIEW_URL_TTL_SECONDS`. */
export interface CustomerOrderDetail extends CustomerOrder {
  imageUrls: string[];
}

/** `data` of POST /orders, reorder, confirm and cancel. */
export interface CustomerOrderResponse {
  order: CustomerOrder;
}

/** `data` of GET /orders/:id. */
export interface CustomerOrderDetailResponse {
  order: CustomerOrderDetail;
}

/** `data` of GET /orders (newest first, paginated). */
export interface CustomerOrdersResponse {
  orders: CustomerOrderSummary[];
}
