import { ErrorCodes, MAX_REPORT_CASH_MISMATCHES, OrderStatus } from "@medstore/shared";
import mongoose from "mongoose";
import { AppError } from "../../utils/AppError.js";
import { istDayBounds } from "../../utils/time.js";
import { Order } from "../orders/order.model.js";
import { Store } from "../stores/store.model.js";

// Orders created in the day, counted by their current status.
const countCreated = async (storeId, { start, end }) => {
  const rows = await Order.aggregate([
    { $match: { storeId, createdAt: { $gte: start, $lt: end } } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const byStatus = Object.fromEntries(Object.values(OrderStatus).map((status) => [status, 0]));
  for (const { _id, count } of rows) byStatus[_id] = count;
  return { total: rows.reduce((sum, row) => sum + row.count, 0), byStatus };
};

const MISMATCH = { $expr: { $ne: ["$cashCollectedPaise", "$totalPaise"] } };

// Orders delivered in the day: cash totals and the orders where collected ≠ expected.
const summariseDelivered = async (storeId, { start, end }) => {
  const [result] = await Order.aggregate([
    { $match: { storeId, deliveredAt: { $gte: start, $lt: end } } },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              expected: { $sum: "$totalPaise" },
              collected: { $sum: "$cashCollectedPaise" },
            },
          },
        ],
        mismatchCount: [{ $match: MISMATCH }, { $count: "count" }],
        mismatches: [
          { $match: MISMATCH },
          { $sort: { deliveredAt: 1, _id: 1 } },
          { $limit: MAX_REPORT_CASH_MISMATCHES },
          {
            $project: {
              orderNumber: 1,
              deliveredAt: 1,
              expected: "$totalPaise",
              collected: "$cashCollectedPaise",
            },
          },
        ],
      },
    },
  ]);
  const totals = result.totals[0] ?? { count: 0, expected: 0, collected: 0 };
  return {
    delivered: {
      count: totals.count,
      expectedCashPaise: totals.expected,
      collectedCashPaise: totals.collected,
      differencePaise: totals.collected - totals.expected,
    },
    cashMismatchCount: result.mismatchCount[0]?.count ?? 0,
    cashMismatches: result.mismatches.map((order) => ({
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      deliveredAt: order.deliveredAt,
      expectedCashPaise: order.expected,
      collectedCashPaise: order.collected,
      differencePaise: order.collected - order.expected,
    })),
  };
};

// Owner only (root 3.1), so every store is in scope, inactive ones included.
export const getDailyReport = async ({ storeId, date }) => {
  const store = await Store.findById(storeId, { code: 1, name: 1 }).lean();
  if (!store) throw new AppError("Store not found", 404, ErrorCodes.STORE_NOT_FOUND);
  const id = new mongoose.Types.ObjectId(storeId);
  const day = istDayBounds(date);
  const [created, delivered] = await Promise.all([
    countCreated(id, day),
    summariseDelivered(id, day),
  ]);
  return {
    store: { id: String(store._id), code: store.code, name: store.name },
    date,
    created,
    ...delivered,
  };
};
