import { randomUUID } from "node:crypto";
import { HistoryActorKind, IDEMPOTENCY_KEY_HEADER, OrderStatus } from "@medstore/shared";
import mongoose from "mongoose";
import { expect, vi } from "vitest";
import { Order } from "../../src/modules/orders/order.model.js";
import { Store } from "../../src/modules/stores/store.model.js";
import { Upload } from "../../src/modules/uploads/upload.model.js";
import { createSignedViewUrls, verifyImageObject } from "../../src/services/storage.js";
import { ADDRESS } from "./customer.js";

// Test files using these helpers mock services/storage.js (and services/email.js) with vi.mock.

export const NOW = new Date("2026-10-02T06:30:00Z"); // 12:00 IST
const HOUR_MS = 60 * 60 * 1000;

// Indexes the tests depend on: 2dsphere for $geoNear, unique order number and idempotency key.
export const ensureOrderIndexes = () => Promise.all([Store.init(), Order.init()]);

export const signedViewUrlFor = (path) => `https://signed.example/view/${path}?token=view`;

// Every image verifies, and view URLs are signed, unless a test says otherwise.
export const mockStorageOk = () => {
  vi.mocked(verifyImageObject).mockResolvedValue(true);
  vi.mocked(createSignedViewUrls).mockImplementation(async (paths) => paths.map(signedViewUrlFor));
};

// A path recorded as issued to `userId`, as POST /uploads/prescriptions would.
export const issueUpload = async (userId, contentType = "image/jpeg", recordedFor = userId) => {
  const ext = contentType === "image/png" ? "png" : "jpg";
  const path = `${userId}/${randomUUID()}.${ext}`;
  await Upload.create({ userId: recordedFor, path, contentType, sizeBytes: 1000 });
  return path;
};

export const placeOrder = (api, body, key = randomUUID()) =>
  api.post("/orders").set(IDEMPOTENCY_KEY_HEADER, key).send(body);

export const reorderOrder = (api, orderId, body = {}, key = randomUUID()) =>
  api.post(`/orders/${orderId}/reorder`).set(IDEMPOTENCY_KEY_HEADER, key).send(body);

const ADMIN_ID = new mongoose.Types.ObjectId();

// Bill fields of an order in AWAITING_CONFIRMATION, sent by an admin at `sentAt`.
export const billFields = ({ version = 1, sentAt = NOW } = {}) => ({
  items: [
    {
      name: "Paracetamol 500",
      nameKey: "paracetamol 500",
      quantity: 2,
      unitPricePaise: 3000,
      lineTotalPaise: 6000,
    },
  ],
  subtotalPaise: 6000,
  discountPaise: 500,
  totalPaise: 8000,
  billVersion: version,
  billSentAt: sentAt,
  billExpiresAt: new Date(sentAt.getTime() + HOUR_MS),
});

// Written straight to the database in any status (admin actions don't exist yet). The history
// includes an admin entry whenever an admin would have acted, so tests can check it never leaks.
export const seedOrder = async ({
  userId,
  storeId,
  status = OrderStatus.PENDING_REVIEW,
  ...rest
}) => {
  const at = new Date();
  const statusHistory = [
    {
      status: OrderStatus.PENDING_REVIEW,
      at,
      by: { kind: HistoryActorKind.CUSTOMER, id: userId },
    },
    ...(status === OrderStatus.PENDING_REVIEW
      ? []
      : [{ status, at, by: { kind: HistoryActorKind.ADMIN, id: ADMIN_ID }, note: "seeded" }]),
  ];
  const order = await Order.create({
    orderNumber: `SEED-${randomUUID()}`,
    userId,
    storeId,
    status,
    idempotencyKey: randomUUID(),
    patientName: "Ravi Rao",
    customerNote: "Old note",
    customerName: "Asha Rao",
    customerPhone: "+919876543210",
    images: [{ path: `${userId}/${randomUUID()}.jpg` }],
    deliveryAddress: {
      label: ADDRESS.label,
      line1: ADDRESS.line1,
      city: ADDRESS.city,
      pincode: ADDRESS.pincode,
      location: { type: "Point", coordinates: [ADDRESS.lng, ADDRESS.lat] },
    },
    distanceKm: 0,
    deliveryFeePaise: 2500,
    statusHistory,
    ...rest,
  });
  return order.toObject();
};

// Holds every Order.findOneAndUpdate until `count` of them are waiting, so concurrent transitions
// have all read the order before any of them writes — the race the conditional update must
// decide. Restore the returned spy when done.
export const holdOrderUpdatesUntil = (count) => {
  const original = Order.findOneAndUpdate;
  let arrived = 0;
  let releaseAll;
  const allArrived = new Promise((resolve) => {
    releaseAll = resolve;
  });
  return vi.spyOn(Order, "findOneAndUpdate").mockImplementation(function (...args) {
    const query = original.apply(this, args);
    const exec = query.exec.bind(query);
    query.exec = async () => {
      arrived += 1;
      if (arrived === count) releaseAll();
      await allArrived;
      return exec();
    };
    return query;
  });
};

// Every key anywhere in a JSON value, as "parent.key" paths without array indexes.
const allKeys = (value, prefix = "") => {
  if (Array.isArray(value)) return value.flatMap((item) => allKeys(item, prefix));
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => [
    `${prefix}${key}`,
    ...allKeys(child, `${prefix}${key}.`),
  ]);
};

// Fields that must never reach a customer.
export const expectNoInternalFields = (body) => {
  const keys = allKeys(body);
  for (const forbidden of [
    "userId",
    "idempotencyKey",
    "images",
    "path",
    "nameKey",
    "customerName",
    "customerPhone",
    "orderCreateSeq",
    "__v",
    "_id",
  ]) {
    expect(keys.filter((key) => key.split(".").at(-1) === forbidden)).toEqual([]);
  }
  expect(keys.filter((key) => key.endsWith("by.id"))).toEqual([]);
  expect(JSON.stringify(body)).not.toContain(String(ADMIN_ID));
};
