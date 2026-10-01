import {
  DeliveryFailedReason,
  OrderAction,
  OrderStatus,
  RejectReason,
  StaffCancelReason,
} from "@medstore/shared";
import { expect } from "vitest";
import { billFields, seedOrder } from "./order.js";

// Test files using these helpers mock services/storage.js and services/email.js with vi.mock.

// An order of `customer` at `store` in `status`; every status past review carries bill 1.
export const seedStoreOrder = (customer, store, status = OrderStatus.PENDING_REVIEW, extra = {}) =>
  seedOrder({
    userId: customer.user.id,
    storeId: store.id,
    status,
    ...(status !== OrderStatus.PENDING_REVIEW && billFields()),
    ...extra,
  });

export const BILL_ITEMS = [
  { name: "Paracetamol 500", quantity: 2, unitPricePaise: 3000 },
  { name: "ORS Sachet", quantity: 1, unitPricePaise: 2000 },
];

export const billBody = (expectedBillVersion = 0, overrides = {}) => ({
  expectedBillVersion,
  items: BILL_ITEMS,
  ...overrides,
});

// A valid request for every staff action in ORDER_TRANSITIONS.
export const ACTION_REQUESTS = {
  [OrderAction.REJECT]: { path: "reject", body: { reasonCode: RejectReason.PRESCRIPTION_UNCLEAR } },
  [OrderAction.SEND_BILL]: { path: "bill", body: billBody(0) },
  [OrderAction.REVISE_BILL]: { path: "bill", body: billBody(1) },
  [OrderAction.STAFF_CANCEL]: {
    path: "cancel",
    body: { reasonCode: StaffCancelReason.CUSTOMER_REQUESTED },
  },
  [OrderAction.PACK]: { path: "pack" },
  [OrderAction.DISPATCH]: { path: "dispatch" },
  [OrderAction.DELIVER]: { path: "deliver", body: { cashCollectedPaise: 8000 } },
  [OrderAction.FAIL_DELIVERY]: {
    path: "fail",
    body: { reasonCode: DeliveryFailedReason.CUSTOMER_UNREACHABLE },
  },
};

export const runAction = (api, orderId, action) => {
  const { path, body } = ACTION_REQUESTS[action];
  const req = api.post(`/orders/${orderId}/${path}`);
  return body ? req.send(body) : req;
};

// Every key anywhere in a JSON value, without array indexes.
const allKeys = (value) => {
  if (Array.isArray(value)) return value.flatMap(allKeys);
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => [key, ...allKeys(child)]);
};

// Internal fields that never leave the server, even for staff.
export const expectNoAdminInternalFields = (body) => {
  const keys = allKeys(body);
  for (const forbidden of [
    "idempotencyKey",
    "images",
    "path",
    "nameKey",
    "userId",
    "orderCreateSeq",
    "passwordHash",
    "__v",
    "_id",
  ]) {
    expect(keys).not.toContain(forbidden);
  }
};
