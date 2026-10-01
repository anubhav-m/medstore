import { HistoryActorKind } from "@medstore/shared";
import { Admin } from "../admins/admin.model.js";
import { Store } from "../stores/store.model.js";
import { toBill, toCancellation, toDeliveryAddress, toReason } from "./order.view.js";

// Admin responses pick their fields explicitly: never idempotencyKey, image paths or item name
// keys. Staff get the customer's copied contact details because they call and deliver.

const STORE_FIELDS = { code: 1, name: 1 };

const toStoreSummary = (store) => ({ id: String(store._id), code: store.code, name: store.name });

const toStatusEntry =
  (adminNames) =>
  ({ status, at, by, note }) => ({
    status,
    at,
    by: {
      kind: by.kind,
      id: by.id ? String(by.id) : null,
      name: by.kind === HistoryActorKind.ADMIN ? (adminNames.get(String(by.id)) ?? null) : null,
    },
    note: note ?? null,
  });

const toAdminOrderSummary = (order, store) => ({
  id: String(order._id),
  orderNumber: order.orderNumber,
  status: order.status,
  store: toStoreSummary(store),
  patientName: order.patientName,
  customerName: order.customerName,
  totalPaise: order.totalPaise ?? null,
  billExpiresAt: order.billExpiresAt ?? null,
  createdAt: order.createdAt,
});

const toAdminOrder = (order, store, adminNames) => ({
  id: String(order._id),
  orderNumber: order.orderNumber,
  status: order.status,
  store: toStoreSummary(store),
  customer: { id: String(order.userId), name: order.customerName, phone: order.customerPhone },
  patientName: order.patientName,
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
  statusHistory: order.statusHistory.map(toStatusEntry(adminNames)),
  reorderedFrom: order.reorderedFrom ? String(order.reorderedFrom) : null,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
});

// Names of the admins in the history, in one query.
const loadAdminNames = async (statusHistory) => {
  const ids = statusHistory
    .filter((entry) => entry.by.kind === HistoryActorKind.ADMIN && entry.by.id)
    .map((entry) => entry.by.id);
  const admins = await Admin.find({ _id: { $in: ids } }, { name: 1 }).lean();
  return new Map(admins.map((admin) => [String(admin._id), admin.name]));
};

// Stores are never deleted, so every order's store exists.
export const presentAdminOrder = async (order) => {
  const [store, adminNames] = await Promise.all([
    Store.findById(order.storeId, STORE_FIELDS).lean(),
    loadAdminNames(order.statusHistory),
  ]);
  return toAdminOrder(order, store, adminNames);
};

// One store query for the whole page.
export const presentAdminOrderSummaries = async (orders) => {
  const storeIds = [...new Set(orders.map((order) => String(order.storeId)))];
  const stores = await Store.find({ _id: { $in: storeIds } }, STORE_FIELDS).lean();
  const storeById = new Map(stores.map((store) => [String(store._id), store]));
  return orders.map((order) => toAdminOrderSummary(order, storeById.get(String(order.storeId))));
};
