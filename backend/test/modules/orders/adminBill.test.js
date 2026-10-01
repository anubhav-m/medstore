import { ErrorCodes, HistoryActorKind, OrderStatus } from "@medstore/shared";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../src/app.js";
import { Order } from "../../../src/modules/orders/order.model.js";
import { Store } from "../../../src/modules/stores/store.model.js";
import { expectError } from "../../helpers/admin.js";
import { BILL_ITEMS, billBody, seedStoreOrder } from "../../helpers/adminOrder.js";
import { onboardedCustomer } from "../../helpers/customer.js";
import {
  NOW,
  ensureOrderIndexes,
  holdOrderUpdatesUntil,
  mockStorageOk,
} from "../../helpers/order.js";
import { createTestStore, signInStaff } from "../../helpers/store.js";

vi.mock("../../../src/services/email.js", () => ({ sendCodeEmail: vi.fn() }));
vi.mock("../../../src/services/storage.js", () => ({
  verifyImageObject: vi.fn(),
  createSignedViewUrls: vi.fn(),
}));

const S = OrderStatus;
const MINUTE_MS = 60_000;
const minutesAfterNow = (minutes) => new Date(NOW.getTime() + minutes * MINUTE_MS).toISOString();

let app;
let customer;
let store;
let staff;
beforeAll(ensureOrderIndexes);
// NOW is 12:00 IST; the store closes at 22:00 and the timeout is 60 minutes.
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  mockStorageOk();
  app = createApp();
  customer = await onboardedCustomer(app, "asha@example.com");
  store = await createTestStore();
  staff = await signInStaff(app, [store.code]);
});
afterEach(() => {
  vi.useRealTimers();
});

const seed = (status) => seedStoreOrder(customer, store, status);
const sendBill = (orderId, body, api = staff) => api.post(`/orders/${orderId}/bill`).send(body);
const stored = (orderId) => Order.findById(orderId).lean();

describe("POST /admin/orders/:id/bill — first bill", () => {
  it("sends bill 1 with server-computed totals and the store's fee", async () => {
    const order = await seed(S.PENDING_REVIEW);

    const res = await sendBill(order._id, billBody(0, { discountPaise: 1000 }));

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Bill sent");
    const view = res.body.data.order;
    expect(view.status).toBe(S.AWAITING_CONFIRMATION);
    expect(view.bill).toEqual({
      version: 1,
      items: [
        { name: "Paracetamol 500", quantity: 2, unitPricePaise: 3000, lineTotalPaise: 6000 },
        { name: "ORS Sachet", quantity: 1, unitPricePaise: 2000, lineTotalPaise: 2000 },
      ],
      subtotalPaise: 8000,
      deliveryFeePaise: 2500,
      discountPaise: 1000,
      totalPaise: 9500,
      sentAt: NOW.toISOString(),
      expiresAt: minutesAfterNow(60),
    });
    expect(view.statusHistory.at(-1)).toMatchObject({
      status: S.AWAITING_CONFIRMATION,
      by: { kind: HistoryActorKind.ADMIN, name: "Staff One" },
    });
    expect((await stored(order._id)).items.map((item) => item.nameKey)).toEqual([
      "paracetamol 500",
      "ors sachet",
    ]);
  });

  it("uses the delivery fee staff send, and no discount by default", async () => {
    const order = await seed(S.PENDING_REVIEW);
    const res = await sendBill(order._id, billBody(0, { deliveryFeePaise: 0 }));
    expect(res.body.data.order.bill).toMatchObject({
      deliveryFeePaise: 0,
      discountPaise: 0,
      totalPaise: 8000,
    });
  });

  it("accepts a discount equal to the subtotal", async () => {
    const order = await seed(S.PENDING_REVIEW);
    const res = await sendBill(order._id, billBody(0, { discountPaise: 8000 }));
    expect(res.body.data.order.bill.totalPaise).toBe(2500);
  });

  it("caps the expiry at the store's closing time", async () => {
    await Store.updateOne({ _id: store.id }, { $set: { closingMinutes: 12 * 60 + 30 } });
    const order = await seed(S.PENDING_REVIEW);
    const res = await sendBill(order._id, billBody(0));
    expect(res.body.data.order.bill.expiresAt).toBe(minutesAfterNow(30));
  });

  it("gives the full timeout to a bill sent after closing", async () => {
    await Store.updateOne({ _id: store.id }, { $set: { closingMinutes: 11 * 60 } });
    const order = await seed(S.PENDING_REVIEW);
    const res = await sendBill(order._id, billBody(0));
    expect(res.body.data.order.bill.expiresAt).toBe(minutesAfterNow(60));
  });

  it("returns 409 INVALID_ORDER_TRANSITION for a first bill on a billed order", async () => {
    const order = await seed(S.AWAITING_CONFIRMATION);
    expectError(await sendBill(order._id, billBody(0)), 409, ErrorCodes.INVALID_ORDER_TRANSITION);
  });
});

describe("POST /admin/orders/:id/bill — revision", () => {
  it("revises the bill: version + 1 and the expiry restarts", async () => {
    const order = await seed(S.PENDING_REVIEW);
    await sendBill(order._id, billBody(0));
    vi.setSystemTime(NOW.getTime() + 10 * MINUTE_MS);

    const res = await sendBill(
      order._id,
      billBody(1, { items: [{ name: "Cetirizine", quantity: 1, unitPricePaise: 1500 }] }),
    );

    expect(res.status).toBe(200);
    expect(res.body.data.order.status).toBe(S.AWAITING_CONFIRMATION);
    expect(res.body.data.order.bill).toMatchObject({
      version: 2,
      items: [{ name: "Cetirizine", quantity: 1, unitPricePaise: 1500, lineTotalPaise: 1500 }],
      totalPaise: 4000,
      sentAt: minutesAfterNow(10),
      expiresAt: minutesAfterNow(70),
    });
    expect(res.body.data.order.statusHistory).toHaveLength(3);
  });

  it("keeps the previous bill's delivery fee when none is sent", async () => {
    const order = await seed(S.PENDING_REVIEW);
    await sendBill(order._id, billBody(0, { deliveryFeePaise: 0 }));
    const res = await sendBill(order._id, billBody(1));
    expect(res.body.data.order.bill.deliveryFeePaise).toBe(0);
  });

  it("returns 409 BILL_CHANGED for an old expected version", async () => {
    const order = await seed(S.PENDING_REVIEW);
    await sendBill(order._id, billBody(0));
    await sendBill(order._id, billBody(1));

    expectError(await sendBill(order._id, billBody(1)), 409, ErrorCodes.BILL_CHANGED);
    expect((await stored(order._id)).billVersion).toBe(2);
  });

  it("lets one of two simultaneous revisions win; the other gets BILL_CHANGED", async () => {
    const order = await seed(S.AWAITING_CONFIRMATION);
    const other = await signInStaff(app, [store.code], "staff.two");
    const spy = holdOrderUpdatesUntil(2);
    try {
      const results = await Promise.all([
        sendBill(order._id, billBody(1)),
        sendBill(order._id, billBody(1), other),
      ]);
      expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
      expectError(
        results.find((res) => res.status === 409),
        409,
        ErrorCodes.BILL_CHANGED,
      );
      expect((await stored(order._id)).billVersion).toBe(2);
    } finally {
      spy.mockRestore();
    }
  });

  it("decides a simultaneous revision and customer confirm with one winner", async () => {
    const order = await seed(S.AWAITING_CONFIRMATION);
    const spy = holdOrderUpdatesUntil(2);
    try {
      const [revise, confirm] = await Promise.all([
        sendBill(order._id, billBody(1)),
        customer.api.post(`/orders/${order._id}/confirm`).send({ billVersion: 1 }),
      ]);
      // A confirm that wins leaves nothing to revise; a revision that wins changes the bill.
      if (confirm.status === 200) {
        expectError(revise, 409, ErrorCodes.ORDER_STATUS_CHANGED);
        expect((await stored(order._id)).billVersion).toBe(1);
      } else {
        expect(revise.status).toBe(200);
        expectError(confirm, 409, ErrorCodes.BILL_CHANGED);
      }
    } finally {
      spy.mockRestore();
    }
  });
});

describe("POST /admin/orders/:id/bill — abuse", () => {
  const item = (overrides) => ({ ...BILL_ITEMS[0], ...overrides });

  it.each([
    ["a negative price", { items: [item({ unitPricePaise: -100 })] }],
    ["a zero price", { items: [item({ unitPricePaise: 0 })] }],
    ["a decimal price", { items: [item({ unitPricePaise: 30.5 })] }],
    ["a price as a string", { items: [item({ unitPricePaise: "3000" })] }],
    ["a price above 10,000,000", { items: [item({ unitPricePaise: 10_000_001 })] }],
    ["a huge price", { items: [item({ unitPricePaise: 1e300 })] }],
    ["quantity 0", { items: [item({ quantity: 0 })] }],
    ["quantity 1000", { items: [item({ quantity: 1000 })] }],
    ["a decimal quantity", { items: [item({ quantity: 1.5 })] }],
    ["a quantity as a string", { items: [item({ quantity: "2" })] }],
    ["a one-letter name", { items: [item({ name: " A " })] }],
    ["a 101-character name", { items: [item({ name: "x".repeat(101) })] }],
    ["no items", { items: [] }],
    ["51 items", { items: Array.from({ length: 51 }, () => item()) }],
    ["a negative delivery fee", { deliveryFeePaise: -1 }],
    ["a delivery fee above 100,000", { deliveryFeePaise: 100_001 }],
    ["a decimal discount", { discountPaise: 0.5 }],
    ["a negative discount", { discountPaise: -1 }],
    ["a discount above the subtotal", { discountPaise: 8001 }],
    ["a client totalPaise", { totalPaise: 1 }],
    ["a client subtotalPaise", { subtotalPaise: 1 }],
    ["a client lineTotalPaise", { items: [item({ lineTotalPaise: 1 })] }],
    ["a client billVersion", { billVersion: 9 }],
    ["no expected version", { expectedBillVersion: undefined }],
    ["a negative expected version", { expectedBillVersion: -1 }],
  ])("rejects %s with 400 VALIDATION_ERROR and stores nothing", async (_case, overrides) => {
    const order = await seed(S.PENDING_REVIEW);

    expectError(
      await sendBill(order._id, billBody(0, overrides)),
      400,
      ErrorCodes.VALIDATION_ERROR,
    );
    const after = await stored(order._id);
    expect(after).toMatchObject({ status: S.PENDING_REVIEW, billVersion: 0, items: [] });
    expect(after.totalPaise).toBeNull();
  });

  it("accepts 50 items at the largest price and quantity", async () => {
    const order = await seed(S.PENDING_REVIEW);
    const items = Array.from({ length: 50 }, (_, index) =>
      item({ name: `Item ${index}`, quantity: 999, unitPricePaise: 10_000_000 }),
    );
    const res = await sendBill(order._id, billBody(0, { items }));
    expect(res.body.data.order.bill.totalPaise).toBe(499_500_002_500);
  });
});

describe("a revised bill across both surfaces", () => {
  it("makes the customer's confirm of the old version fail with BILL_CHANGED", async () => {
    const order = await seed(S.PENDING_REVIEW);
    const first = await sendBill(order._id, billBody(0));
    const seen = (await customer.api.get(`/orders/${order._id}`)).body.data.order.bill.version;
    expect(seen).toBe(first.body.data.order.bill.version);

    await sendBill(order._id, billBody(seen, { discountPaise: 500 }));

    const stale = await customer.api.post(`/orders/${order._id}/confirm`).send({
      billVersion: seen,
    });
    expectError(stale, 409, ErrorCodes.BILL_CHANGED);
    expect((await stored(order._id)).status).toBe(S.AWAITING_CONFIRMATION);

    const fresh = await customer.api.post(`/orders/${order._id}/confirm`).send({
      billVersion: seen + 1,
    });
    expect(fresh.status).toBe(200);
    expect(fresh.body.data.order.bill.totalPaise).toBe(10000);
  });
});
