import {
  HistoryActorKind,
  OPEN_ORDER_STATUSES,
  OrderAction,
  OrderListScope,
  TERMINAL_ORDER_STATUSES,
} from "@medstore/shared";
import { createSignedViewUrls } from "../../services/storage.js";
import { paginationMeta, skipFor } from "../../utils/pagination.js";
import { orderNotFound, transitionOrder } from "./orderTransition.js";
import { Order } from "./order.model.js";
import { presentOrder, presentOrderSummaries } from "./order.view.js";

// Customer reads and actions. Every query includes the caller's userId.

const STATUSES_FOR_SCOPE = {
  [OrderListScope.ACTIVE]: OPEN_ORDER_STATUSES,
  [OrderListScope.PAST]: TERMINAL_ORDER_STATUSES,
};

const SUMMARY_FIELDS = {
  orderNumber: 1,
  status: 1,
  storeId: 1,
  patientName: 1,
  totalPaise: 1,
  createdAt: 1,
};

export const listOrders = async (userId, { scope, ...page }) => {
  const filter = { userId, ...(scope && { status: { $in: STATUSES_FOR_SCOPE[scope] } }) };
  const [orders, total] = await Promise.all([
    Order.find(filter, SUMMARY_FIELDS)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skipFor(page))
      .limit(page.limit)
      .lean(),
    Order.countDocuments(filter),
  ]);
  return { orders: await presentOrderSummaries(orders), meta: paginationMeta(page, total) };
};

// The only customer response with photo URLs (short-lived, signed per request).
export const getOrder = async (userId, orderId) => {
  const order = await Order.findOne({ _id: orderId, userId }).lean();
  if (!order) throw orderNotFound();
  const [view, imageUrls] = await Promise.all([
    presentOrder(order),
    createSignedViewUrls(order.images.map((image) => image.path)),
  ]);
  return { ...view, imageUrls };
};

const asCustomer = (userId) => ({
  by: { kind: HistoryActorKind.CUSTOMER, id: userId },
  scope: { userId },
});

export const confirmOrder = async (userId, orderId, billVersion) =>
  presentOrder(
    await transitionOrder({
      orderId,
      action: OrderAction.CONFIRM,
      ...asCustomer(userId),
      billVersion,
    }),
  );

export const cancelOrder = async (userId, orderId, { reasonCode, note }) =>
  presentOrder(
    await transitionOrder({
      orderId,
      action: OrderAction.CUSTOMER_CANCEL,
      ...asCustomer(userId),
      set: {
        cancellation: {
          byKind: HistoryActorKind.CUSTOMER,
          code: reasonCode ?? null,
          note: note ?? null,
        },
      },
      note: note ?? null,
    }),
  );
