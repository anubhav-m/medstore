import { ErrorCodes, HistoryActorKind, OrderStatus } from "@medstore/shared";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../src/app.js";
import { Order } from "../../../src/modules/orders/order.model.js";
import { createSignedViewUrls } from "../../../src/services/storage.js";
import { AppError } from "../../../src/utils/AppError.js";
import { expectError } from "../../helpers/admin.js";
import { onboardedCustomer } from "../../helpers/customer.js";
import {
  NOW,
  billFields,
  ensureOrderIndexes,
  expectNoInternalFields,
  mockStorageOk,
  seedOrder,
  signedViewUrlFor,
} from "../../helpers/order.js";
import { createTestStore } from "../../helpers/store.js";

vi.mock("../../../src/services/email.js", () => ({ sendCodeEmail: vi.fn() }));
vi.mock("../../../src/services/storage.js", () => ({
  verifyImageObject: vi.fn(),
  createSignedViewUrls: vi.fn(),
}));

const MINUTE_MS = 60_000;

let app;
let customer;
let store;
beforeAll(ensureOrderIndexes);
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  mockStorageOk();
  app = createApp();
  customer = await onboardedCustomer(app, "asha@example.com");
  store = await createTestStore();
});
afterEach(() => {
  vi.useRealTimers();
});

// Each a minute later than the last, so "newest first" is unambiguous.
const seedInOrder = async (statuses, userId = customer.user.id) => {
  const orders = [];
  for (const [index, status] of statuses.entries()) {
    vi.setSystemTime(NOW.getTime() + index * MINUTE_MS);
    orders.push(await seedOrder({ userId, storeId: store.id, status }));
  }
  vi.setSystemTime(NOW);
  return orders;
};

describe("GET /orders", () => {
  it("lists the caller's orders newest first as summaries, without photo URLs", async () => {
    const other = await onboardedCustomer(app, "b@example.com");
    await seedOrder({ userId: other.user.id, storeId: store.id });
    const [, middle, newest] = await seedInOrder([
      OrderStatus.PENDING_REVIEW,
      OrderStatus.PENDING_REVIEW,
      OrderStatus.AWAITING_CONFIRMATION,
    ]);
    await Order.updateOne({ _id: newest._id }, { $set: billFields() });

    const res = await customer.api.get("/orders?limit=2");

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Orders loaded");
    expect(res.body.meta).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
    expect(res.body.data.orders).toEqual([
      {
        id: String(newest._id),
        orderNumber: newest.orderNumber,
        status: OrderStatus.AWAITING_CONFIRMATION,
        store: { id: store.id, name: store.name },
        patientName: "Ravi Rao",
        totalPaise: 8000,
        createdAt: new Date(NOW.getTime() + 2 * MINUTE_MS).toISOString(),
      },
      expect.objectContaining({ id: String(middle._id), totalPaise: null }),
    ]);
    expect(createSignedViewUrls).not.toHaveBeenCalled();
    expectNoInternalFields(res.body);
  });

  it("pages through the orders", async () => {
    const orders = await seedInOrder([
      OrderStatus.DELIVERED,
      OrderStatus.DELIVERED,
      OrderStatus.DELIVERED,
    ]);
    const res = await customer.api.get("/orders?page=2&limit=2");

    expect(res.body.meta).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
    expect(res.body.data.orders.map((order) => order.id)).toEqual([String(orders[0]._id)]);
  });

  it("uses 20 per page by default", async () => {
    const res = await customer.api.get("/orders");
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 0, totalPages: 0 });
    expect(res.body.data.orders).toEqual([]);
  });

  it.each([
    ["active", [OrderStatus.PENDING_REVIEW, OrderStatus.PACKED]],
    ["past", [OrderStatus.CANCELLED, OrderStatus.DELIVERED]],
  ])("filters scope=%s", async (scope, expected) => {
    await seedInOrder([
      OrderStatus.PENDING_REVIEW,
      OrderStatus.CANCELLED,
      OrderStatus.PACKED,
      OrderStatus.DELIVERED,
    ]);
    const res = await customer.api.get(`/orders?scope=${scope}`);
    expect(res.body.data.orders.map((order) => order.status)).toEqual([...expected].reverse());
  });

  it.each([
    ["an unknown scope", "scope=open"],
    ["page 0", "page=0"],
    ["a limit over 100", "limit=101"],
    ["a non-numeric page", "page=two"],
    ["an unknown parameter", "userId=x"],
  ])("rejects %s with 400 VALIDATION_ERROR", async (_case, query) => {
    expectError(await customer.api.get(`/orders?${query}`), 400, ErrorCodes.VALIDATION_ERROR);
  });
});

describe("GET /orders/:id", () => {
  it("returns the full order with signed photo URLs and a customer-safe history", async () => {
    const order = await seedOrder({
      userId: customer.user.id,
      storeId: store.id,
      status: OrderStatus.AWAITING_CONFIRMATION,
      ...billFields(),
      images: [{ path: `${customer.user.id}/a.jpg` }, { path: `${customer.user.id}/b.png` }],
    });

    const res = await customer.api.get(`/orders/${order._id}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Order loaded");
    const view = res.body.data.order;
    expect(view.imageUrls).toEqual([
      signedViewUrlFor(`${customer.user.id}/a.jpg`),
      signedViewUrlFor(`${customer.user.id}/b.png`),
    ]);
    expect(createSignedViewUrls).toHaveBeenCalledExactlyOnceWith([
      `${customer.user.id}/a.jpg`,
      `${customer.user.id}/b.png`,
    ]);
    expect(view.bill).toEqual({
      version: 1,
      items: [{ name: "Paracetamol 500", quantity: 2, unitPricePaise: 3000, lineTotalPaise: 6000 }],
      subtotalPaise: 6000,
      deliveryFeePaise: 2500,
      discountPaise: 500,
      totalPaise: 8000,
      sentAt: NOW.toISOString(),
      expiresAt: new Date(NOW.getTime() + 60 * MINUTE_MS).toISOString(),
    });
    expect(view.totalPaise).toBe(8000);
    expect(view.statusHistory).toEqual([
      {
        status: OrderStatus.PENDING_REVIEW,
        at: NOW.toISOString(),
        by: { kind: HistoryActorKind.CUSTOMER },
        note: null,
      },
      {
        status: OrderStatus.AWAITING_CONFIRMATION,
        at: NOW.toISOString(),
        by: { kind: HistoryActorKind.ADMIN },
        note: "seeded",
      },
    ]);
    expectNoInternalFields(res.body);
  });

  it("returns 404 ORDER_NOT_FOUND for another customer's order", async () => {
    const other = await onboardedCustomer(app, "b@example.com");
    const theirs = await seedOrder({ userId: other.user.id, storeId: store.id });

    expectError(await customer.api.get(`/orders/${theirs._id}`), 404, ErrorCodes.ORDER_NOT_FOUND);
    expect(createSignedViewUrls).not.toHaveBeenCalled();
  });

  it("returns 404 ORDER_NOT_FOUND for an id that doesn't exist", async () => {
    expectError(
      await customer.api.get("/orders/64b000000000000000000000"),
      404,
      ErrorCodes.ORDER_NOT_FOUND,
    );
  });

  it("returns 400 INVALID_ID for a malformed id", async () => {
    expectError(await customer.api.get("/orders/nope"), 400, ErrorCodes.INVALID_ID);
  });

  it("returns 503 SERVICE_UNAVAILABLE when the photos can't be signed", async () => {
    const order = await seedOrder({ userId: customer.user.id, storeId: store.id });
    vi.mocked(createSignedViewUrls).mockRejectedValue(
      new AppError("Unavailable", 503, ErrorCodes.SERVICE_UNAVAILABLE),
    );
    expectError(
      await customer.api.get(`/orders/${order._id}`),
      503,
      ErrorCodes.SERVICE_UNAVAILABLE,
    );
  });
});
