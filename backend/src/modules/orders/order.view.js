import { fromPoint } from "../../utils/geo.js";
import { Store } from "../stores/store.model.js";

// Customer responses pick their fields explicitly: never userId, idempotencyKey, image paths,
// item name keys, the copied contact details or an admin's id.

const toStatusEntry = ({ status, at, by, note }) => ({
  status,
  at,
  by: { kind: by.kind },
  note: note ?? null,
});

const toBill = (order) =>
  order.billVersion > 0
    ? {
        version: order.billVersion,
        items: order.items.map(({ name, quantity, unitPricePaise, lineTotalPaise }) => ({
          name,
          quantity,
          unitPricePaise,
          lineTotalPaise,
        })),
        subtotalPaise: order.subtotalPaise,
        deliveryFeePaise: order.deliveryFeePaise,
        discountPaise: order.discountPaise,
        totalPaise: order.totalPaise,
        sentAt: order.billSentAt,
        expiresAt: order.billExpiresAt,
      }
    : null;

const toReason = (reason) => (reason ? { code: reason.code, note: reason.note ?? null } : null);

const toCancellation = (cancellation) =>
  cancellation
    ? {
        byKind: cancellation.byKind,
        code: cancellation.code ?? null,
        note: cancellation.note ?? null,
      }
    : null;

const toDeliveryAddress = ({ label, line1, line2, landmark, city, pincode, location }) => ({
  label,
  line1,
  line2: line2 ?? null,
  landmark: landmark ?? null,
  city,
  pincode,
  ...fromPoint(location),
});

const toCustomerOrderSummary = (order, store) => ({
  id: String(order._id),
  orderNumber: order.orderNumber,
  status: order.status,
  store: { id: String(store._id), name: store.name },
  patientName: order.patientName,
  totalPaise: order.totalPaise ?? null,
  createdAt: order.createdAt,
});

const toCustomerOrder = (order, store) => ({
  ...toCustomerOrderSummary(order, store),
  store: { id: String(store._id), name: store.name, phone: store.phone },
  customerNote: order.customerNote ?? null,
  deliveryAddress: toDeliveryAddress(order.deliveryAddress),
  distanceKm: order.distanceKm,
  bill: toBill(order),
  paymentMethod: order.paymentMethod,
  paymentStatus: order.paymentStatus,
  cashCollectedPaise: order.cashCollectedPaise ?? null,
  deliveredAt: order.deliveredAt ?? null,
  rejection: toReason(order.rejection),
  cancellation: toCancellation(order.cancellation),
  deliveryFailure: toReason(order.deliveryFailure),
  statusHistory: order.statusHistory.map(toStatusEntry),
  reorderedFrom: order.reorderedFrom ? String(order.reorderedFrom) : null,
  updatedAt: order.updatedAt,
});

// Stores are never deleted, so every order's store exists.
export const presentOrder = async (order) =>
  toCustomerOrder(order, await Store.findById(order.storeId, { name: 1, phone: 1 }).lean());

// One store query for the whole page.
export const presentOrderSummaries = async (orders) => {
  const storeIds = [...new Set(orders.map((order) => String(order.storeId)))];
  const stores = await Store.find({ _id: { $in: storeIds } }, { name: 1 }).lean();
  const storeById = new Map(stores.map((store) => [String(store._id), store]));
  return orders.map((order) => toCustomerOrderSummary(order, storeById.get(String(order.storeId))));
};
