import { randomUUID } from "node:crypto";
import { ErrorCodes, HistoryActorKind, OrderStatus } from "@medstore/shared";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../src/app.js";
import { Order } from "../../../src/modules/orders/order.model.js";
import { Store } from "../../../src/modules/stores/store.model.js";
import { Upload } from "../../../src/modules/uploads/upload.model.js";
import { User } from "../../../src/modules/users/user.model.js";
import { verifyImageObject } from "../../../src/services/storage.js";
import { expectError } from "../../helpers/admin.js";
import { ADDRESS, onboardedCustomer } from "../../helpers/customer.js";
import {
  NOW,
  ensureOrderIndexes,
  expectNoInternalFields,
  issueUpload,
  mockStorageOk,
  placeOrder,
  reorderOrder,
  seedOrder,
} from "../../helpers/order.js";
import { createTestStore, northOfAddress } from "../../helpers/store.js";

vi.mock("../../../src/services/email.js", () => ({ sendCodeEmail: vi.fn() }));
vi.mock("../../../src/services/storage.js", () => ({
  verifyImageObject: vi.fn(),
  createSignedViewUrls: vi.fn(),
}));

const S = OrderStatus;

let app;
let customer;
let store;
let source;
let imagePaths;
beforeAll(ensureOrderIndexes);
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  mockStorageOk();
  app = createApp();
  customer = await onboardedCustomer(app, "asha@example.com");
  store = await createTestStore();
  imagePaths = [
    await issueUpload(customer.user.id),
    await issueUpload(customer.user.id, "image/png"),
  ];
  await Upload.updateMany({ path: { $in: imagePaths } }, { $set: { attachedAt: NOW } });
  source = await seedDelivered();
});
afterEach(() => {
  vi.useRealTimers();
});

const seedDelivered = (extra = {}) =>
  seedOrder({
    userId: customer.user.id,
    storeId: store.id,
    status: S.DELIVERED,
    images: imagePaths.map((path) => ({ path })),
    ...extra,
  });

const orderCount = () => Order.countDocuments({ userId: customer.user.id });

describe("POST /orders/:id/reorder", () => {
  it("places a new order at the same store with the same photos, patient and address", async () => {
    const res = await reorderOrder(customer.api, source._id, { note: "Refill" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Order placed");
    const { order } = res.body.data;
    expect(order).toMatchObject({
      orderNumber: "ST01-000001",
      status: S.PENDING_REVIEW,
      store: { id: store.id },
      patientName: "Ravi Rao",
      customerNote: "Refill",
      // The source order's copy, which has no line2 or landmark (the saved address has both).
      deliveryAddress: {
        label: ADDRESS.label,
        line1: ADDRESS.line1,
        line2: null,
        landmark: null,
        city: ADDRESS.city,
        pincode: ADDRESS.pincode,
        lat: ADDRESS.lat,
        lng: ADDRESS.lng,
      },
      distanceKm: 0,
      reorderedFrom: String(source._id),
      statusHistory: [
        {
          status: S.PENDING_REVIEW,
          at: NOW.toISOString(),
          by: { kind: HistoryActorKind.CUSTOMER },
          note: null,
        },
      ],
    });
    expect(order.id).not.toBe(String(source._id));
    expectNoInternalFields(res.body);

    const stored = await Order.findById(order.id).lean();
    expect(stored.images).toEqual(imagePaths.map((path) => ({ path })));
    expect(stored).toMatchObject({ customerName: "Asha Rao", customerPhone: "+919876543210" });
    expect(verifyImageObject).toHaveBeenCalledWith(imagePaths[0], "image/jpeg");
    expect(verifyImageObject).toHaveBeenCalledWith(imagePaths[1], "image/png");
  });

  it("doesn't copy the old note", async () => {
    const res = await reorderOrder(customer.api, source._id);
    expect(res.body.data.order.customerNote).toBeNull();
  });

  it("measures the radius from the copied pin to where the store is now", async () => {
    await Store.updateOne(
      { _id: store.id },
      { $set: { location: { type: "Point", coordinates: [ADDRESS.lng, northOfAddress(3).lat] } } },
    );
    const res = await reorderOrder(customer.api, source._id);
    expect(res.body.data.order.distanceKm).toBe(3);
  });

  it.each(Object.values(S).filter((status) => status !== S.DELIVERED))(
    "returns 409 REORDER_NOT_ALLOWED from %s",
    async (status) => {
      const order = await seedDelivered({ status });
      expectError(await reorderOrder(customer.api, order._id), 409, ErrorCodes.REORDER_NOT_ALLOWED);
    },
  );

  it("returns 404 ORDER_NOT_FOUND for another customer's order", async () => {
    const other = await onboardedCustomer(app, "b@example.com");
    const theirs = await seedOrder({
      userId: other.user.id,
      storeId: store.id,
      status: S.DELIVERED,
    });

    expectError(await reorderOrder(customer.api, theirs._id), 404, ErrorCodes.ORDER_NOT_FOUND);
    expect(await Order.countDocuments({ reorderedFrom: theirs._id })).toBe(0);
  });

  it("returns 404 ORDER_NOT_FOUND for an id that doesn't exist", async () => {
    expectError(
      await reorderOrder(customer.api, "64b000000000000000000000"),
      404,
      ErrorCodes.ORDER_NOT_FOUND,
    );
  });

  it("returns 400 INVALID_ID for a malformed id", async () => {
    expectError(await reorderOrder(customer.api, "nope"), 400, ErrorCodes.INVALID_ID);
  });

  it("returns 403 ACCOUNT_BLOCKED before looking at the order", async () => {
    await User.updateOne({ _id: customer.user.id }, { $set: { isBlocked: true } });
    const res = await reorderOrder(customer.api, "64b000000000000000000000");
    expectError(res, 403, ErrorCodes.ACCOUNT_BLOCKED);
  });

  it.each([
    ["paused", { isAcceptingOrders: false }, 409, ErrorCodes.STORE_NOT_ACCEPTING_ORDERS],
    ["inactive", { isActive: false }, 409, ErrorCodes.STORE_NOT_ACCEPTING_ORDERS],
    ["closed", { openingMinutes: 900 }, 409, ErrorCodes.STORE_CLOSED],
    [
      "moved out of range",
      { location: { type: "Point", coordinates: [ADDRESS.lng, northOfAddress(6).lat] } },
      422,
      ErrorCodes.OUTSIDE_DELIVERY_AREA,
    ],
  ])("refuses when the store is %s", async (_case, change, status, code) => {
    await Store.updateOne({ _id: store.id }, { $set: change });

    expectError(await reorderOrder(customer.api, source._id), status, code);
    expect(verifyImageObject).not.toHaveBeenCalled();
    expect(await orderCount()).toBe(1);
  });

  it("returns 422 INVALID_UPLOAD when a photo no longer verifies", async () => {
    vi.mocked(verifyImageObject).mockImplementation(async (path) => path !== imagePaths[1]);
    expectError(await reorderOrder(customer.api, source._id), 422, ErrorCodes.INVALID_UPLOAD);
    expect(await orderCount()).toBe(1);
  });

  it("returns 422 INVALID_UPLOAD when a photo's upload record is gone", async () => {
    await Upload.deleteOne({ path: imagePaths[0] });
    expectError(await reorderOrder(customer.api, source._id), 422, ErrorCodes.INVALID_UPLOAD);
  });

  it("returns 409 TOO_MANY_OPEN_ORDERS at 3 orders in progress", async () => {
    for (let index = 0; index < 3; index += 1) {
      await seedOrder({ userId: customer.user.id, storeId: store.id });
    }
    expectError(await reorderOrder(customer.api, source._id), 409, ErrorCodes.TOO_MANY_OPEN_ORDERS);
  });

  it("returns the original reorder on a retry with the same key", async () => {
    const key = randomUUID();
    const first = await reorderOrder(customer.api, source._id, {}, key);
    const retry = await reorderOrder(customer.api, source._id, {}, key);

    expect(retry.body.data.order.id).toBe(first.body.data.order.id);
    expect(await orderCount()).toBe(2);
  });

  it("requires an Idempotency-Key", async () => {
    const res = await customer.api.post(`/orders/${source._id}/reorder`).send({});
    expectError(res, 400, ErrorCodes.VALIDATION_ERROR);
  });

  it.each([
    ["patientName", "Someone Else"],
    ["storeId", "64b000000000000000000000"],
    ["imagePaths", []],
    ["status", S.CONFIRMED],
  ])("rejects a client-supplied %s with 400", async (field, value) => {
    const res = await reorderOrder(customer.api, source._id, { [field]: value });
    expectError(res, 400, ErrorCodes.VALIDATION_ERROR);
    expect(res.body.errors).toEqual([{ field, message: "This field is not allowed" }]);
  });

  it("shares the per-customer limit with new orders → 429 TOO_MANY_REQUESTS", async () => {
    const limited = createApp({ rateLimits: { orderCreate: { windowMs: 60_000, limit: 1 } } });
    const { api } = await onboardedCustomer(limited, "limited@example.com");
    expect((await placeOrder(api, {})).status).toBe(400);
    expectError(await reorderOrder(api, source._id), 429, ErrorCodes.TOO_MANY_REQUESTS);
  });
});
