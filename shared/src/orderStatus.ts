export const OrderStatus = {
  PENDING_REVIEW: "PENDING_REVIEW",
  AWAITING_CONFIRMATION: "AWAITING_CONFIRMATION",
  CONFIRMED: "CONFIRMED",
  PACKED: "PACKED",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
  DELIVERY_FAILED: "DELIVERY_FAILED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = [
  OrderStatus.REJECTED,
  OrderStatus.CANCELLED,
  OrderStatus.DELIVERED,
  OrderStatus.DELIVERY_FAILED,
];

// STAFF means staff of the order's store, or an OWNER.
export const TransitionActor = {
  CUSTOMER: "CUSTOMER",
  STAFF: "STAFF",
  SYSTEM: "SYSTEM",
} as const;

export type TransitionActor = (typeof TransitionActor)[keyof typeof TransitionActor];

export const OrderAction = {
  REJECT: "REJECT",
  SEND_BILL: "SEND_BILL",
  REVISE_BILL: "REVISE_BILL",
  CONFIRM: "CONFIRM",
  CUSTOMER_CANCEL: "CUSTOMER_CANCEL",
  EXPIRE_BILL: "EXPIRE_BILL",
  STAFF_CANCEL: "STAFF_CANCEL",
  PACK: "PACK",
  DISPATCH: "DISPATCH",
  DELIVER: "DELIVER",
  FAIL_DELIVERY: "FAIL_DELIVERY",
} as const;

export type OrderAction = (typeof OrderAction)[keyof typeof OrderAction];

export interface OrderTransition {
  action: OrderAction;
  from: readonly OrderStatus[];
  to: OrderStatus;
  actor: TransitionActor;
}

const { CUSTOMER, STAFF, SYSTEM } = TransitionActor;
const S = OrderStatus;

export const ORDER_TRANSITIONS: readonly OrderTransition[] = [
  { action: OrderAction.REJECT, from: [S.PENDING_REVIEW], to: S.REJECTED, actor: STAFF },
  {
    action: OrderAction.SEND_BILL,
    from: [S.PENDING_REVIEW],
    to: S.AWAITING_CONFIRMATION,
    actor: STAFF,
  },
  {
    action: OrderAction.REVISE_BILL,
    from: [S.AWAITING_CONFIRMATION],
    to: S.AWAITING_CONFIRMATION,
    actor: STAFF,
  },
  {
    action: OrderAction.CONFIRM,
    from: [S.AWAITING_CONFIRMATION],
    to: S.CONFIRMED,
    actor: CUSTOMER,
  },
  {
    action: OrderAction.CUSTOMER_CANCEL,
    from: [S.PENDING_REVIEW, S.AWAITING_CONFIRMATION],
    to: S.CANCELLED,
    actor: CUSTOMER,
  },
  {
    action: OrderAction.EXPIRE_BILL,
    from: [S.AWAITING_CONFIRMATION],
    to: S.CANCELLED,
    actor: SYSTEM,
  },
  {
    action: OrderAction.STAFF_CANCEL,
    from: [S.AWAITING_CONFIRMATION, S.CONFIRMED, S.PACKED],
    to: S.CANCELLED,
    actor: STAFF,
  },
  { action: OrderAction.PACK, from: [S.CONFIRMED], to: S.PACKED, actor: STAFF },
  { action: OrderAction.DISPATCH, from: [S.PACKED], to: S.OUT_FOR_DELIVERY, actor: STAFF },
  { action: OrderAction.DELIVER, from: [S.OUT_FOR_DELIVERY], to: S.DELIVERED, actor: STAFF },
  {
    action: OrderAction.FAIL_DELIVERY,
    from: [S.OUT_FOR_DELIVERY],
    to: S.DELIVERY_FAILED,
    actor: STAFF,
  },
];
