import { randomUUID } from "node:crypto";
import { ErrorCodes, HistoryActorKind, MAX_ORDER_IMAGES, OrderStatus } from "@medstore/shared";
import mongoose from "mongoose";
import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../src/app.js";
import { Order } from "../../../src/modules/orders/order.model.js";
import { Store } from "../../../src/modules/stores/store.model.js";
import { Upload } from "../../../src/modules/uploads/upload.model.js";
import { User } from "../../../src/modules/users/user.model.js";
import { verifyImageObject } from "../../../src/services/storage.js";
import { AppError } from "../../../src/utils/AppError.js";
import { expectError, signInAdmin } from "../../helpers/admin.js";
import { API } from "../../helpers/auth.js";
import { ADDRESS, onboardedCustomer, signedUpCustomer } from "../../helpers/customer.js";
import {
  NOW,
  ensureOrderIndexes,
  expectNoInternalFields,
  issueUpload,
  mockStorageOk,
  placeOrder,
  seedOrder,
} from "../../helpers/order.js";
import { createTestStore, northOfAddress } from "../../helpers/store.js";

vi.mock("../../../src/services/email.js", () => ({ sendCodeEmail: vi.fn() }));
vi.mock("../../../src/services/storage.js", () => ({
  verifyImageObject: vi.fn(),
  createSignedViewUrls: vi.fn(),
}));

let app;
let customer;
let store;
let body;
beforeAll(ensureOrderIndexes);
// The clock is fixed before signing in, so access tokens are valid at the faked time.
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  mockStorageOk();
  app = createApp();
  customer = await onboardedCustomer(app, "asha@example.com");
  store = await createTestStore({ ...northOfAddress(2) });
  body = {
    storeId: store.id,
    addressId: customer.address.id,
    imagePaths: [await issueUpload(customer.user.id)],
  };
});
afterEach(() => {
  vi.useRealTimers();
});

const place = (overrides = {}, api = customer.api, key = undefined) =>
  placeOrder(api, { ...body, ...overrides }, key);

const orderCount = () => Order.countDocuments({ userId: customer.user.id });

describe("POST /orders", () => {
  it("places a PENDING_REVIEW order with copies of the address, contact and fee", async () => {
    const png = await issueUpload(customer.user.id, "image/png");
    const imagePaths = [body.imagePaths[0], png];
    const key = randomUUID().toUpperCase();

    const res = await place({ imagePaths, note: "Two strips please" }, customer.api, key);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Order placed");
    const { order } = res.body.data;
    expect(order).toEqual({
      id: expect.any(String),
      orderNumber: "ST01-000001",
      status: OrderStatus.PENDING_REVIEW,
      store: { id: store.id, name: store.name, phone: store.phone },
      patientName: "Asha Rao",
      totalPaise: null,
      createdAt: NOW.toISOString(),
      customerNote: "Two strips please",
      deliveryAddress: {
        label: ADDRESS.label,
        line1: ADDRESS.line1,
        line2: ADDRESS.line2,
        landmark: ADDRESS.landmark,
        city: ADDRESS.city,
        pincode: ADDRESS.pincode,
        lat: ADDRESS.lat,
        lng: ADDRESS.lng,
      },
      distanceKm: 2,
      bill: null,
      paymentMethod: "COD",
      paymentStatus: "PENDING",
      cashCollectedPaise: null,
      deliveredAt: null,
      rejection: null,
      cancellation: null,
      deliveryFailure: null,
      statusHistory: [
        {
          status: OrderStatus.PENDING_REVIEW,
          at: NOW.toISOString(),
          by: { kind: HistoryActorKind.CUSTOMER },
          note: null,
        },
      ],
      reorderedFrom: null,
      updatedAt: NOW.toISOString(),
    });
    expectNoInternalFields(res.body);

    const stored = await Order.findById(order.id).lean();
    expect(stored).toMatchObject({
      customerName: "Asha Rao",
      customerPhone: "+919876543210",
      deliveryFeePaise: store.deliveryFeePaise,
      idempotencyKey: key.toLowerCase(),
      images: imagePaths.map((path) => ({ path })),
      deliveryAddress: { location: { type: "Point", coordinates: [ADDRESS.lng, ADDRESS.lat] } },
    });
    expect(String(stored.statusHistory[0].by.id)).toBe(customer.user.id);
    expect(verifyImageObject).toHaveBeenCalledWith(body.imagePaths[0], "image/jpeg");
    expect(verifyImageObject).toHaveBeenCalledWith(png, "image/png");
  });

  it("marks the order's uploads attached and leaves other uploads alone", async () => {
    const unused = await issueUpload(customer.user.id);
    await place();

    const attached = await Upload.findOne({ path: body.imagePaths[0] }).lean();
    expect(attached.attachedAt).toEqual(NOW);
    expect((await Upload.findOne({ path: unused }).lean()).attachedAt).toBeNull();
  });

  it("uses the given patient name", async () => {
    const res = await place({ patientName: "  Ravi Rao " });
    expect(res.body.data.order.patientName).toBe("Ravi Rao");
  });

  it("copies the store's current delivery fee", async () => {
    await Store.updateOne({ _id: store.id }, { $set: { deliveryFeePaise: 4000 } });
    const res = await place();
    expect((await Order.findById(res.body.data.order.id).lean()).deliveryFeePaise).toBe(4000);
  });

  it("numbers orders per store from an atomic counter that never resets", async () => {
    const other = await createTestStore({ code: "ST02", ...northOfAddress(1) });
    const first = await place();
    await Order.updateOne({ _id: first.body.data.order.id }, { status: OrderStatus.DELIVERED });
    const second = await place({ imagePaths: [await issueUpload(customer.user.id)] });
    const atOther = await place({
      storeId: other.id,
      imagePaths: [await issueUpload(customer.user.id)],
    });

    expect(first.body.data.order.orderNumber).toBe("ST01-000001");
    expect(second.body.data.order.orderNumber).toBe("ST01-000002");
    expect(atOther.body.data.order.orderNumber).toBe("ST02-000001");
  });

  it("accepts up to 5 photos", async () => {
    const imagePaths = await Promise.all(
      Array.from({ length: MAX_ORDER_IMAGES }, () => issueUpload(customer.user.id)),
    );
    expect((await place({ imagePaths })).status).toBe(200);
  });
});

describe("POST /orders — validation", () => {
  it.each([
    ["status", OrderStatus.DELIVERED],
    ["totalPaise", 1],
    ["items", [{ name: "x", quantity: 1, unitPricePaise: 1 }]],
    ["orderNumber", "ST01-999999"],
    ["userId", "64b000000000000000000000"],
    ["billVersion", 1],
    ["customerPhone", "+919999999999"],
  ])("rejects a client-supplied %s with 400", async (field, value) => {
    const res = await place({ [field]: value });

    expectError(res, 400, ErrorCodes.VALIDATION_ERROR);
    expect(res.body.errors).toEqual([{ field, message: "This field is not allowed" }]);
    expect(await orderCount()).toBe(0);
  });

  it.each([
    ["no photos", { imagePaths: [] }],
    ["6 photos", { imagePaths: Array.from({ length: 6 }, (_, i) => `p${i}`) }],
    ["a missing storeId", { storeId: undefined }],
    ["a malformed addressId", { addressId: "nope" }],
    ["a one-letter patient name", { patientName: "A" }],
    ["a 501-character note", { note: "x".repeat(501) }],
    ["a path that isn't a string", { imagePaths: [{ $ne: null }] }],
  ])("rejects %s with 400 VALIDATION_ERROR", async (_case, overrides) => {
    expectError(await place(overrides), 400, ErrorCodes.VALIDATION_ERROR);
    expect(verifyImageObject).not.toHaveBeenCalled();
  });

  it("rejects the same photo twice with 400", async () => {
    const res = await place({ imagePaths: [body.imagePaths[0], body.imagePaths[0]] });

    expectError(res, 400, ErrorCodes.VALIDATION_ERROR);
    expect(res.body.errors).toEqual([
      { field: "imagePaths", message: "Each photo can be added once" },
    ]);
  });

  it.each([
    ["missing", undefined],
    ["not a UUID", "order-1"],
  ])("rejects an Idempotency-Key that is %s with 400", async (_case, key) => {
    const req = customer.api.post("/orders");
    const res = await (key === undefined ? req : req.set("Idempotency-Key", key)).send(body);

    expectError(res, 400, ErrorCodes.VALIDATION_ERROR);
    expect(res.body.errors).toEqual([
      { field: "idempotency-key", message: "Send a UUID in the Idempotency-Key header" },
    ]);
  });

  it("returns 403 ONBOARDING_REQUIRED before onboarding", async () => {
    const api = await signedUpCustomer(app, "new@example.com");
    expectError(await place({}, api), 403, ErrorCodes.ONBOARDING_REQUIRED);
  });

  it("requires a customer token: none or an admin's → 401 INVALID_TOKEN", async () => {
    expectError(await request(app).post(`${API}/orders`).send(body), 401, ErrorCodes.INVALID_TOKEN);
    const { accessToken } = await signInAdmin(app);
    const res = await request(app)
      .post(`${API}/orders`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", randomUUID())
      .send(body);
    expectError(res, 401, ErrorCodes.INVALID_TOKEN);
  });

  it("limits order creations per customer → 429 TOO_MANY_REQUESTS", async () => {
    const limited = createApp({ rateLimits: { orderCreate: { windowMs: 60_000, limit: 1 } } });
    const { api } = await onboardedCustomer(limited, "limited@example.com");
    expect((await placeOrder(api, body)).status).not.toBe(429);
    expectError(await placeOrder(api, body), 429, ErrorCodes.TOO_MANY_REQUESTS);
  });
});

// Each case breaks its own check and every later one it can, so only the first may answer.
describe("POST /orders — creation checks run in order", () => {
  const block = () => User.updateOne({ _id: customer.user.id }, { $set: { isBlocked: true } });
  const fillOpenOrders = async () => {
    for (let index = 0; index < 3; index += 1) {
      await seedOrder({ userId: customer.user.id, storeId: store.id });
    }
  };
  const unissuedPath = () => `${customer.user.id}/${randomUUID()}.jpg`;
  const othersAddress = async () => (await onboardedCustomer(app, "b@example.com")).address.id;
  const brokenStore = async (overrides) =>
    (await createTestStore({ code: "BAD", ...northOfAddress(8), ...overrides })).id;

  it.each([
    [
      "1 blocked",
      403,
      ErrorCodes.ACCOUNT_BLOCKED,
      async () => {
        await block();
        return { addressId: await othersAddress(), storeId: String(new mongoose.Types.ObjectId()) };
      },
    ],
    [
      "2 address",
      404,
      ErrorCodes.ADDRESS_NOT_FOUND,
      async () => ({
        addressId: await othersAddress(),
        storeId: String(new mongoose.Types.ObjectId()),
      }),
    ],
    [
      "3 store missing",
      404,
      ErrorCodes.STORE_NOT_FOUND,
      async () => ({ storeId: String(new mongoose.Types.ObjectId()) }),
    ],
    [
      "3 store paused",
      409,
      ErrorCodes.STORE_NOT_ACCEPTING_ORDERS,
      async () => ({
        storeId: await brokenStore({ isAcceptingOrders: false, openingMinutes: 900 }),
      }),
    ],
    [
      "3 store inactive",
      409,
      ErrorCodes.STORE_NOT_ACCEPTING_ORDERS,
      async () => ({ storeId: await brokenStore({ isActive: false, openingMinutes: 900 }) }),
    ],
    [
      "3 store closed",
      409,
      ErrorCodes.STORE_CLOSED,
      async () => ({ storeId: await brokenStore({ openingMinutes: 900 }) }),
    ],
    [
      "4 radius",
      422,
      ErrorCodes.OUTSIDE_DELIVERY_AREA,
      async () => ({ storeId: await brokenStore() }),
    ],
    ["5 images", 422, ErrorCodes.INVALID_UPLOAD, async () => ({})],
  ])("check %s fails first → %i %s", async (_case, status, code, arrange) => {
    await fillOpenOrders();
    const overrides = { imagePaths: [unissuedPath()], ...(await arrange()) };

    expectError(await place(overrides), status, code);
    expect(verifyImageObject).not.toHaveBeenCalled();
    expect(await orderCount()).toBe(3);
  });

  it("check 6 → 409 TOO_MANY_OPEN_ORDERS", async () => {
    await fillOpenOrders();
    expectError(await place(), 409, ErrorCodes.TOO_MANY_OPEN_ORDERS);
    expect(await orderCount()).toBe(3);
  });
});

describe("POST /orders — store hours and radius", () => {
  it.each([
    ["exactly at opening", { openingMinutes: 720 }, 200],
    ["exactly at closing", { openingMinutes: 600, closingMinutes: 720 }, 409],
    ["one minute before opening", { openingMinutes: 721 }, 409],
  ])("at 12:00 IST, a store %s answers %i", async (_case, hours, status) => {
    await Store.updateOne({ _id: store.id }, { $set: hours });
    const res = await place();

    expect(res.status).toBe(status);
    if (status === 409) expect(res.body.code).toBe(ErrorCodes.STORE_CLOSED);
  });

  it("decides the radius on the exact distance from the address pin", async () => {
    const inside = await createTestStore({ code: "IN", ...northOfAddress(4.96) });
    const outside = await createTestStore({ code: "OUT", ...northOfAddress(5.04) });

    expect((await place({ storeId: inside.id })).status).toBe(200);
    expectError(await place({ storeId: outside.id }), 422, ErrorCodes.OUTSIDE_DELIVERY_AREA);
  });
});

describe("POST /orders — photos", () => {
  it("rejects another customer's path → 422 INVALID_UPLOAD", async () => {
    const other = await onboardedCustomer(app, "other@example.com");
    const theirs = await issueUpload(other.user.id);

    expectError(await place({ imagePaths: [theirs] }), 422, ErrorCodes.INVALID_UPLOAD);
    expect(verifyImageObject).not.toHaveBeenCalled();
  });

  it("rejects a path under the caller's folder that was issued to someone else", async () => {
    const other = new mongoose.Types.ObjectId();
    const path = await issueUpload(customer.user.id, "image/jpeg", other);
    expectError(await place({ imagePaths: [path] }), 422, ErrorCodes.INVALID_UPLOAD);
  });

  it("rejects a well-formed path that was never issued", async () => {
    const path = `${customer.user.id}/${randomUUID()}.jpg`;
    expectError(await place({ imagePaths: [path] }), 422, ErrorCodes.INVALID_UPLOAD);
  });

  it.each([
    ["a parent folder", (id) => `${id}/../${randomUUID()}.jpg`],
    ["a GIF extension", (id) => `${id}/${randomUUID()}.gif`],
    ["a double extension", (id) => `${id}/${randomUUID()}.jpg.png`],
    ["a leading slash", (id) => `/${id}/${randomUUID()}.jpg`],
    ["an upper-case UUID", (id) => `${id}/${randomUUID().toUpperCase()}.jpg`],
    ["no folder", () => `${randomUUID()}.jpg`],
  ])("rejects a path with %s", async (_case, build) => {
    const path = build(customer.user.id);
    await Upload.create({
      userId: customer.user.id,
      path,
      contentType: "image/jpeg",
      sizeBytes: 1,
    });

    expectError(await place({ imagePaths: [path] }), 422, ErrorCodes.INVALID_UPLOAD);
    expect(verifyImageObject).not.toHaveBeenCalled();
  });

  it("rejects the order when any photo fails the storage check, creating nothing", async () => {
    const good = await issueUpload(customer.user.id);
    const bad = await issueUpload(customer.user.id);
    vi.mocked(verifyImageObject).mockImplementation(async (path) => path !== bad);

    expectError(await place({ imagePaths: [good, bad] }), 422, ErrorCodes.INVALID_UPLOAD);
    expect(await orderCount()).toBe(0);
    expect((await Upload.findOne({ path: good }).lean()).attachedAt).toBeNull();
  });

  it("returns 503 SERVICE_UNAVAILABLE when storage can't be checked", async () => {
    vi.mocked(verifyImageObject).mockRejectedValue(
      new AppError("Unavailable", 503, ErrorCodes.SERVICE_UNAVAILABLE),
    );
    expectError(await place(), 503, ErrorCodes.SERVICE_UNAVAILABLE);
    expect(await orderCount()).toBe(0);
  });
});
