import { AdminOrderTab, ErrorCodes, HistoryActorKind, OrderStatus } from "@medstore/shared";
import mongoose from "mongoose";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../src/app.js";
import { createSignedViewUrls } from "../../../src/services/storage.js";
import { AppError } from "../../../src/utils/AppError.js";
import { expectError } from "../../helpers/admin.js";
import { billBody, expectNoAdminInternalFields, seedStoreOrder } from "../../helpers/adminOrder.js";
import { ADDRESS, ONBOARDING, onboardedCustomer } from "../../helpers/customer.js";
import {
  NOW,
  billFields,
  ensureOrderIndexes,
  mockStorageOk,
  signedViewUrlFor,
} from "../../helpers/order.js";
import { createTestStore, signInOwner, signInStaff } from "../../helpers/store.js";

vi.mock("../../../src/services/email.js", () => ({ sendCodeEmail: vi.fn() }));
vi.mock("../../../src/services/storage.js", () => ({
  verifyImageObject: vi.fn(),
  createSignedViewUrls: vi.fn(),
}));

const S = OrderStatus;
const MINUTE_MS = 60_000;

let app;
let customer;
let store;
let owner;
beforeAll(ensureOrderIndexes);
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  mockStorageOk();
  app = createApp();
  customer = await onboardedCustomer(app, "asha@example.com");
  store = await createTestStore();
  owner = await signInOwner(app);
});
afterEach(() => {
  vi.useRealTimers();
});

// Created `minutes` after NOW, so creation order is unambiguous.
const seedAt = async (minutes, status, extra = {}) => {
  vi.setSystemTime(NOW.getTime() + minutes * MINUTE_MS);
  const order = await seedStoreOrder(customer, store, status, extra);
  vi.setSystemTime(NOW);
  return order;
};

const ids = (res) => res.body.data.orders.map((order) => order.id);

describe("GET /admin/orders", () => {
  it("lists summaries without photo URLs, newest first when no tab is given", async () => {
    const older = await seedAt(0, S.PENDING_REVIEW);
    const newer = await seedAt(1, S.AWAITING_CONFIRMATION);

    const res = await owner.get("/orders");

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Orders loaded");
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 });
    expect(res.body.data.orders).toEqual([
      {
        id: String(newer._id),
        orderNumber: newer.orderNumber,
        status: S.AWAITING_CONFIRMATION,
        store: { id: store.id, code: "ST01", name: store.name },
        patientName: "Ravi Rao",
        customerName: "Asha Rao",
        totalPaise: 8000,
        billExpiresAt: new Date(NOW.getTime() + 60 * MINUTE_MS).toISOString(),
        createdAt: new Date(NOW.getTime() + MINUTE_MS).toISOString(),
      },
      expect.objectContaining({ id: String(older._id), totalPaise: null, billExpiresAt: null }),
    ]);
    expectNoAdminInternalFields(res.body);
  });

  it("lists the New tab oldest first, only PENDING_REVIEW", async () => {
    const first = await seedAt(0, S.PENDING_REVIEW);
    const second = await seedAt(1, S.PENDING_REVIEW);
    await seedAt(2, S.CONFIRMED);

    const res = await owner.get(`/orders?tab=${AdminOrderTab.NEW}`);
    expect(ids(res)).toEqual([String(first._id), String(second._id)]);
  });

  it("lists the Awaiting customer tab by bill expiry, soonest first", async () => {
    const late = await seedAt(0, S.AWAITING_CONFIRMATION, billFields({ sentAt: NOW }));
    const soon = await seedAt(1, S.AWAITING_CONFIRMATION, {
      ...billFields({ sentAt: new Date(NOW.getTime() - 30 * MINUTE_MS) }),
    });

    const res = await owner.get(`/orders?tab=${AdminOrderTab.AWAITING_CUSTOMER}`);
    expect(ids(res)).toEqual([String(soon._id), String(late._id)]);
  });

  it.each([
    [AdminOrderTab.PREPARING, [S.CONFIRMED, S.PACKED], "oldest"],
    [AdminOrderTab.OUT_FOR_DELIVERY, [S.OUT_FOR_DELIVERY, S.OUT_FOR_DELIVERY], "oldest"],
    [AdminOrderTab.DELIVERED, [S.DELIVERED, S.DELIVERED], "newest"],
    [AdminOrderTab.CLOSED, [S.REJECTED, S.CANCELLED, S.DELIVERY_FAILED], "newest"],
  ])("lists the %s tab with its statuses, %s first", async (tab, statuses, first) => {
    const seeded = [];
    for (const [index, status] of statuses.entries()) seeded.push(await seedAt(index, status));
    await seedAt(10, S.PENDING_REVIEW);

    const res = await owner.get(`/orders?tab=${tab}`);

    const expected = seeded.map((order) => String(order._id));
    expect(ids(res)).toEqual(first === "oldest" ? expected : expected.reverse());
  });

  it("paginates", async () => {
    for (let index = 0; index < 3; index += 1) await seedAt(index, S.PENDING_REVIEW);
    const res = await owner.get(`/orders?tab=${AdminOrderTab.NEW}&page=2&limit=2`);
    expect(res.body.meta).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
    expect(res.body.data.orders).toHaveLength(1);
  });

  it.each([
    ["an unknown tab", "tab=SHIPPED"],
    ["an empty q", "q="],
    ["a 51-character q", `q=${"1".repeat(51)}`],
    ["a malformed storeId", "storeId=nope"],
    ["an unknown parameter", "status=PENDING_REVIEW"],
    ["limit 101", "limit=101"],
  ])("rejects %s with 400 VALIDATION_ERROR", async (_case, query) => {
    expectError(await owner.get(`/orders?${query}`), 400, ErrorCodes.VALIDATION_ERROR);
  });

  it("returns 404 STORE_NOT_FOUND for a store that doesn't exist", async () => {
    const res = await owner.get(`/orders?storeId=${new mongoose.Types.ObjectId()}`);
    expectError(res, 404, ErrorCodes.STORE_NOT_FOUND);
  });
});

describe("GET /admin/orders?q=", () => {
  let byNumber;
  let byPhone;
  beforeEach(async () => {
    byNumber = await seedAt(0, S.PENDING_REVIEW, {
      orderNumber: "ST01-000042",
      customerPhone: "+919000000001",
    });
    byPhone = await seedAt(1, S.PENDING_REVIEW, {
      orderNumber: "ST01-000777",
      customerPhone: "+919876543210",
    });
  });

  const search = (q) => owner.get(`/orders?q=${encodeURIComponent(q)}`);

  it.each([
    ["the full order number", "ST01-000042"],
    ["an order-number prefix in lowercase", "st01-0000"],
  ])("finds an order by %s", async (_case, q) => {
    expect(ids(await search(q))).toEqual([String(byNumber._id)]);
  });

  it.each([
    ["10 digits", "9876543210"],
    ["+91 with spaces", "+91 98765 43210"],
    ["a leading 0 and dashes", "098765-43210"],
    ["the first digits", "98765"],
    ["+91 and the first digits", "+9198765"],
  ])("finds an order by phone: %s", async (_case, q) => {
    expect(ids(await search(q))).toEqual([String(byPhone._id)]);
  });

  it("matches both orders by a shared prefix", async () => {
    expect(ids(await search("ST01-000"))).toHaveLength(2);
  });

  it("finds orders whose all-digit store code looks like a phone", async () => {
    const digitsStore = await createTestStore({ code: "12", name: "Digits Medical" });
    const order = await seedStoreOrder(customer, digitsStore, S.PENDING_REVIEW, {
      orderNumber: "12-000001",
    });
    expect(ids(await search("12-0000"))).toEqual([String(order._id)]);
  });

  it.each([".*", "(a+)+$", "[", "ST01.*", "^", "\\", "$where"])(
    "treats %s as literal text and answers quickly",
    async (q) => {
      const started = performance.now();
      const res = await search(q);
      expect(res.status).toBe(200);
      expect(res.body.data.orders).toEqual([]);
      expect(performance.now() - started).toBeLessThan(2000);
    },
  );

  it("treats a long catastrophic pattern as literal text", async () => {
    const res = await search(`${"a".repeat(40)}(a+)+$`);
    expect(res.status).toBe(200);
    expect(res.body.data.orders).toEqual([]);
  });
});

describe("GET /admin/orders/counts", () => {
  it("counts orders per tab in the admin's stores", async () => {
    const other = await createTestStore({ code: "ST02", name: "Second Store" });
    for (const status of [S.PENDING_REVIEW, S.PENDING_REVIEW, S.CONFIRMED, S.PACKED, S.REJECTED]) {
      await seedStoreOrder(customer, store, status);
    }
    await seedStoreOrder(customer, other, S.DELIVERED);

    const all = await owner.get("/orders/counts");
    expect(all.status).toBe(200);
    expect(all.body.message).toBe("Order counts loaded");
    expect(all.body.data.counts).toEqual({
      NEW: 2,
      AWAITING_CUSTOMER: 0,
      PREPARING: 2,
      OUT_FOR_DELIVERY: 0,
      DELIVERED: 1,
      CLOSED: 1,
    });

    const one = await owner.get(`/orders/counts?storeId=${other.id}`);
    expect(one.body.data.counts).toMatchObject({ NEW: 0, DELIVERED: 1, CLOSED: 0 });
  });

  it("returns 404 STORE_NOT_FOUND for a store that doesn't exist", async () => {
    const res = await owner.get(`/orders/counts?storeId=${new mongoose.Types.ObjectId()}`);
    expectError(res, 404, ErrorCodes.STORE_NOT_FOUND);
  });
});

describe("GET /admin/orders/:id", () => {
  it("returns everything staff need, with signed photo URLs and admin names", async () => {
    const staff = await signInStaff(app, [store.code]);
    const order = await seedStoreOrder(customer, store, S.PENDING_REVIEW, {
      deliveryAddress: {
        ...ADDRESS,
        location: { type: "Point", coordinates: [ADDRESS.lng, ADDRESS.lat] },
      },
    });
    await staff.post(`/orders/${order._id}/bill`).send(billBody(0));

    const res = await owner.get(`/orders/${order._id}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Order loaded");
    const view = res.body.data.order;
    expect(view).toMatchObject({
      id: String(order._id),
      orderNumber: order.orderNumber,
      status: S.AWAITING_CONFIRMATION,
      store: { id: store.id, code: "ST01", name: store.name },
      customer: {
        id: customer.user.id,
        name: "Asha Rao",
        phone: "+919876543210",
        isDeleted: false,
      },
      patientName: "Ravi Rao",
      customerNote: "Old note",
      deliveryAddress: { ...ADDRESS },
      distanceKm: 0,
      paymentMethod: "COD",
      paymentStatus: "PENDING",
      imageUrls: [signedViewUrlFor(order.images[0].path)],
    });
    expect(view.bill).toMatchObject({ version: 1, totalPaise: 10500 });
    expect(view.statusHistory).toEqual([
      {
        status: S.PENDING_REVIEW,
        at: NOW.toISOString(),
        by: { kind: HistoryActorKind.CUSTOMER, id: customer.user.id, name: null },
        note: null,
      },
      {
        status: S.AWAITING_CONFIRMATION,
        at: NOW.toISOString(),
        by: { kind: HistoryActorKind.ADMIN, id: expect.any(String), name: "Staff One" },
        note: null,
      },
    ]);
    expect(createSignedViewUrls).toHaveBeenCalledWith([order.images[0].path]);
    expectNoAdminInternalFields({ ...res.body, data: { ...view, imageUrls: [] } });
  });

  it("uses the contact details copied into the order, not the current profile", async () => {
    const order = await seedStoreOrder(customer, store);
    await customer.api.patch("/me").send({ name: "Asha R", phone: "9123456789" });
    const res = await owner.get(`/orders/${order._id}`);
    expect(res.body.data.order.customer).toMatchObject({
      name: ONBOARDING.name,
      phone: "+919876543210",
    });
  });

  it("returns 404 ORDER_NOT_FOUND for an order that doesn't exist", async () => {
    const res = await owner.get(`/orders/${new mongoose.Types.ObjectId()}`);
    expectError(res, 404, ErrorCodes.ORDER_NOT_FOUND);
  });

  it("returns 400 INVALID_ID for a malformed id", async () => {
    expectError(await owner.get("/orders/nope"), 400, ErrorCodes.INVALID_ID);
  });

  it("returns 503 SERVICE_UNAVAILABLE when the photos can't be signed", async () => {
    const order = await seedStoreOrder(customer, store);
    vi.mocked(createSignedViewUrls).mockRejectedValue(
      new AppError("Unavailable", 503, ErrorCodes.SERVICE_UNAVAILABLE),
    );
    expectError(await owner.get(`/orders/${order._id}`), 503, ErrorCodes.SERVICE_UNAVAILABLE);
  });
});
