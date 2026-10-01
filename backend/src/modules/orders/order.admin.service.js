import {
  ADMIN_ORDER_TABS,
  AdminOrderSort,
  ErrorCodes,
  INDIAN_MOBILE_INPUT_PATTERN,
  INDIAN_PHONE_PREFIX,
  MAX_ITEM_SUGGESTIONS,
} from "@medstore/shared";
import { createSignedViewUrls } from "../../services/storage.js";
import { AppError } from "../../utils/AppError.js";
import { prefixPattern } from "../../utils/escapeRegex.js";
import { paginationMeta, skipFor } from "../../utils/pagination.js";
import { getStoreScope } from "../stores/storeScope.js";
import { orderNotFound } from "./orderTransition.js";
import { presentAdminOrder, presentAdminOrderSummaries } from "./order.admin.view.js";
import { Order } from "./order.model.js";

// Admin reads. Every query is limited to the stores in getStoreScope(admin) (backend 6).

const TAB_DEFINITIONS = new Map(ADMIN_ORDER_TABS.map((definition) => [definition.tab, definition]));

const SORTS = {
  [AdminOrderSort.OLDEST_FIRST]: { createdAt: 1, _id: 1 },
  [AdminOrderSort.NEWEST_FIRST]: { createdAt: -1, _id: -1 },
  [AdminOrderSort.BILL_EXPIRES_FIRST]: { billExpiresAt: 1, _id: 1 },
};

const SUMMARY_FIELDS = {
  orderNumber: 1,
  status: 1,
  storeId: 1,
  patientName: 1,
  customerName: 1,
  totalPaise: 1,
  billExpiresAt: 1,
  createdAt: 1,
};

// The admin's stores, or just `storeId` when it is one of them. Outside the scope (or unknown)
// is 404, so staff can't learn which other stores exist.
const scopedStoreIds = async (admin, storeId) => {
  const scope = await getStoreScope(admin);
  if (storeId === undefined) return scope;
  const match = scope.find((id) => String(id) === storeId);
  if (!match) throw new AppError("Store not found", 404, ErrorCodes.STORE_NOT_FOUND);
  return [match];
};

const PARTIAL_PHONE = /^\d{1,9}$/;

// A complete number in any accepted format matches exactly; fewer digits match the start of the
// 10-digit number.
const phoneMatch = (q) => {
  const compact = q.replace(/[\s-]/g, "");
  const complete = INDIAN_MOBILE_INPUT_PATTERN.exec(compact);
  if (complete) return `${INDIAN_PHONE_PREFIX}${complete[1]}`;
  const digits = compact.startsWith(INDIAN_PHONE_PREFIX)
    ? compact.slice(INDIAN_PHONE_PREFIX.length)
    : compact;
  return PARTIAL_PHONE.test(digits)
    ? { $regex: prefixPattern(`${INDIAN_PHONE_PREFIX}${digits}`) }
    : null;
};

// Order numbers are uppercase, so an uppercased, case-sensitive prefix can use the index.
// Store codes may be all digits, so the order-number match is always tried as well.
const searchFilter = (q) => {
  const phone = phoneMatch(q);
  return {
    $or: [
      { orderNumber: { $regex: prefixPattern(q.toUpperCase()) } },
      ...(phone ? [{ customerPhone: phone }] : []),
    ],
  };
};

export const listOrders = async (admin, { storeId, tab, q, ...page }) => {
  const definition = tab && TAB_DEFINITIONS.get(tab);
  const filter = {
    storeId: { $in: await scopedStoreIds(admin, storeId) },
    ...(definition && { status: { $in: definition.statuses } }),
    ...(q && searchFilter(q)),
  };
  const [orders, total] = await Promise.all([
    Order.find(filter, SUMMARY_FIELDS)
      .sort(SORTS[definition?.sort ?? AdminOrderSort.NEWEST_FIRST])
      .skip(skipFor(page))
      .limit(page.limit)
      .lean(),
    Order.countDocuments(filter),
  ]);
  return { orders: await presentAdminOrderSummaries(orders), meta: paginationMeta(page, total) };
};

// One aggregation by status, summed into tabs.
export const countOrders = async (admin, { storeId }) => {
  const rows = await Order.aggregate([
    { $match: { storeId: { $in: await scopedStoreIds(admin, storeId) } } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const byStatus = new Map(rows.map((row) => [row._id, row.count]));
  return Object.fromEntries(
    ADMIN_ORDER_TABS.map(({ tab, statuses }) => [
      tab,
      statuses.reduce((sum, status) => sum + (byStatus.get(status) ?? 0), 0),
    ]),
  );
};

// The only admin response with photo URLs (short-lived, signed per request).
export const getOrder = async (admin, orderId) => {
  const order = await Order.findOne({
    _id: orderId,
    storeId: { $in: await getStoreScope(admin) },
  }).lean();
  if (!order) throw orderNotFound();
  const [view, imageUrls] = await Promise.all([
    presentAdminOrder(order),
    createSignedViewUrls(order.images.map((image) => image.path)),
  ]);
  return { ...view, imageUrls };
};

// Distinct names billed at the store before, by case-insensitive prefix (name keys are
// lowercase). The most recent spelling of each name is shown.
export const suggestItemNames = async (admin, { storeId, q }) => {
  const [id] = await scopedStoreIds(admin, storeId);
  const nameKey = { $regex: prefixPattern(q.toLowerCase()) };
  const rows = await Order.aggregate([
    { $match: { storeId: id, "items.nameKey": nameKey } },
    { $project: { items: 1, createdAt: 1 } },
    { $unwind: "$items" },
    { $match: { "items.nameKey": nameKey } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: "$items.nameKey", name: { $first: "$items.name" } } },
    { $sort: { _id: 1 } },
    { $limit: MAX_ITEM_SUGGESTIONS },
  ]);
  return rows.map((row) => row.name);
};
