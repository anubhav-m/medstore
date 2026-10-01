import { ErrorCodes, MAX_REPORT_CASH_MISMATCHES, OrderStatus } from "@medstore/shared";
import mongoose from "mongoose";
import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../src/app.js";
import { ADMIN_API, expectError } from "../../helpers/admin.js";
import { billFields, ensureOrderIndexes, NOW, seedOrder } from "../../helpers/order.js";
import { createTestStore, signInOwner, signInStaff } from "../../helpers/store.js";

// NOW is 2026-10-02 12:00 IST. The IST day 2026-10-01 runs from 2026-09-30T18:30Z to
// 2026-10-01T18:30Z (exclusive).
const DATE = "2026-10-01";
const DAY_START = new Date("2026-09-30T18:30:00.000Z");
const LAST_MS = new Date("2026-10-01T18:29:59.999Z");
const LAST_SECOND = new Date("2026-10-01T18:29:59.000Z");
const NEXT_DAY_START = new Date("2026-10-01T18:30:00.000Z");
const ZERO_STATUSES = Object.fromEntries(Object.values(OrderStatus).map((status) => [status, 0]));

let app;
let owner;
let store;
beforeAll(ensureOrderIndexes);
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  app = createApp();
  owner = await signInOwner(app);
  store = await createTestStore();
});
afterEach(() => {
  vi.useRealTimers();
});

const userId = new mongoose.Types.ObjectId();

const seed = (status, { createdAt = DAY_START, ...extra } = {}) =>
  seedOrder({
    userId,
    storeId: extra.storeId ?? store.id,
    status,
    createdAt,
    ...(status !== OrderStatus.PENDING_REVIEW && billFields()),
    ...extra,
  });

// A DELIVERED order (total 8000 from billFields) delivered at `deliveredAt`.
const delivered = (deliveredAt, cashCollectedPaise = 8000, extra = {}) =>
  seed(OrderStatus.DELIVERED, { deliveredAt, cashCollectedPaise, ...extra });

const report = (query, api = owner) => api.get("/reports/daily").query(query);

const reportFor = async (date, storeId = store.id) => {
  const res = await report({ storeId, date });
  expect(res.status).toBe(200);
  return res.body.data.report;
};

describe("GET /admin/reports/daily", () => {
  it("counts the day's orders by status and sums the day's deliveries", async () => {
    await seed(OrderStatus.PENDING_REVIEW);
    await seed(OrderStatus.PENDING_REVIEW, { createdAt: LAST_MS });
    await seed(OrderStatus.CANCELLED);
    // Created the day before, delivered on the day: counted only under `delivered`.
    await delivered(DAY_START, 8000, { createdAt: new Date("2026-09-30T10:00:00Z") });
    // Created on the day, delivered the next day: counted only under `created`.
    await delivered(NEXT_DAY_START, 8000, { createdAt: DAY_START });
    // Other days and other stores are left out.
    await seed(OrderStatus.PENDING_REVIEW, { createdAt: NEXT_DAY_START });
    const other = await createTestStore({ code: "ST02" });
    await seed(OrderStatus.PENDING_REVIEW, { storeId: other.id });
    await delivered(DAY_START, 1, { storeId: other.id });

    const res = await report({ storeId: store.id, date: DATE });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Report loaded");
    expect(res.body.data.report).toEqual({
      store: { id: store.id, code: "ST01", name: store.name },
      date: DATE,
      created: {
        total: 4,
        byStatus: {
          ...ZERO_STATUSES,
          [OrderStatus.PENDING_REVIEW]: 2,
          [OrderStatus.CANCELLED]: 1,
          [OrderStatus.DELIVERED]: 1,
        },
      },
      delivered: {
        count: 1,
        expectedCashPaise: 8000,
        collectedCashPaise: 8000,
        differencePaise: 0,
      },
      cashMismatchCount: 0,
      cashMismatches: [],
    });
  });

  it("counts a delivery at 18:29:59 UTC for that IST date and one at 18:30:00 for the next", async () => {
    await delivered(LAST_SECOND, 7000);
    await delivered(NEXT_DAY_START, 9000);

    const day = await reportFor(DATE);
    const nextDay = await reportFor("2026-10-02");

    expect(day.delivered).toEqual({
      count: 1,
      expectedCashPaise: 8000,
      collectedCashPaise: 7000,
      differencePaise: -1000,
    });
    expect(nextDay.delivered).toEqual({
      count: 1,
      expectedCashPaise: 8000,
      collectedCashPaise: 9000,
      differencePaise: 1000,
    });
  });

  it("uses the same IST day boundaries for created orders", async () => {
    await seed(OrderStatus.PENDING_REVIEW, { createdAt: new Date(DAY_START.getTime() - 1) });
    await seed(OrderStatus.PENDING_REVIEW, { createdAt: DAY_START });
    await seed(OrderStatus.PENDING_REVIEW, { createdAt: LAST_MS });
    await seed(OrderStatus.PENDING_REVIEW, { createdAt: NEXT_DAY_START });

    expect((await reportFor("2026-09-30")).created.total).toBe(1);
    expect((await reportFor(DATE)).created.total).toBe(2);
    expect((await reportFor("2026-10-02")).created.total).toBe(1);
  });

  it("lists the deliveries where collected cash differs from the total, oldest first", async () => {
    const later = new Date("2026-10-01T10:00:00Z");
    const short = await delivered(later, 7500);
    await delivered(DAY_START, 8000);
    const over = await delivered(DAY_START, 10000);
    const nothing = await delivered(LAST_MS, 0);

    const day = await reportFor(DATE);

    expect(day.delivered).toEqual({
      count: 4,
      expectedCashPaise: 32000,
      collectedCashPaise: 25500,
      differencePaise: -6500,
    });
    expect(day.cashMismatchCount).toBe(3);
    expect(day.cashMismatches).toEqual([
      {
        orderId: String(over._id),
        orderNumber: over.orderNumber,
        deliveredAt: DAY_START.toISOString(),
        expectedCashPaise: 8000,
        collectedCashPaise: 10000,
        differencePaise: 2000,
      },
      {
        orderId: String(short._id),
        orderNumber: short.orderNumber,
        deliveredAt: later.toISOString(),
        expectedCashPaise: 8000,
        collectedCashPaise: 7500,
        differencePaise: -500,
      },
      {
        orderId: String(nothing._id),
        orderNumber: nothing.orderNumber,
        deliveredAt: LAST_MS.toISOString(),
        expectedCashPaise: 8000,
        collectedCashPaise: 0,
        differencePaise: -8000,
      },
    ]);
  });

  it(`lists at most ${MAX_REPORT_CASH_MISMATCHES} mismatches but counts them all`, async () => {
    await Promise.all(
      Array.from({ length: MAX_REPORT_CASH_MISMATCHES + 1 }, (_, index) =>
        delivered(new Date(DAY_START.getTime() + index * 1000), 1),
      ),
    );

    const day = await reportFor(DATE);

    expect(day.cashMismatchCount).toBe(MAX_REPORT_CASH_MISMATCHES + 1);
    expect(day.cashMismatches).toHaveLength(MAX_REPORT_CASH_MISMATCHES);
    expect(day.cashMismatches[0].deliveredAt).toBe(DAY_START.toISOString());
  });

  it("returns zeros for a day without orders", async () => {
    expect(await reportFor(DATE)).toMatchObject({
      created: { total: 0, byStatus: ZERO_STATUSES },
      delivered: { count: 0, expectedCashPaise: 0, collectedCashPaise: 0, differencePaise: 0 },
      cashMismatchCount: 0,
      cashMismatches: [],
    });
  });

  it("accepts today's IST date", async () => {
    await seed(OrderStatus.PENDING_REVIEW, { createdAt: NOW });
    expect((await reportFor("2026-10-02")).created.total).toBe(1);
  });

  it("reports on an inactive store", async () => {
    const inactive = await createTestStore({ code: "OLD", isActive: false });
    expect((await reportFor(DATE, inactive.id)).store.code).toBe("OLD");
  });

  it.each([
    ["a future date", { date: "2026-10-03" }, "date"],
    ["a bad format", { date: "01-10-2026" }, "date"],
    ["a single-digit month", { date: "2026-1-05" }, "date"],
    ["an impossible date", { date: "2026-02-30" }, "date"],
    ["a missing date", { date: undefined }, "date"],
    ["a missing store", { storeId: undefined }, "storeId"],
    ["a malformed store id", { storeId: "nope" }, "storeId"],
    ["an unknown key", { extra: "1" }, "extra"],
  ])("returns 400 VALIDATION_ERROR for %s", async (_label, overrides, field) => {
    const query = Object.fromEntries(
      Object.entries({ storeId: store.id, date: DATE, ...overrides }).filter(
        ([, value]) => value !== undefined,
      ),
    );
    const res = await report(query);
    expectError(res, 400, ErrorCodes.VALIDATION_ERROR);
    expect(res.body.errors.map((error) => error.field)).toContain(field);
  });

  it("returns 404 STORE_NOT_FOUND for an unknown store", async () => {
    const storeId = String(new mongoose.Types.ObjectId());
    expectError(await report({ storeId, date: DATE }), 404, ErrorCodes.STORE_NOT_FOUND);
  });

  it("returns 403 FORBIDDEN to staff, for their own store and for others", async () => {
    const other = await createTestStore({ code: "ST02" });
    const staff = await signInStaff(app, ["ST01"]);

    expectError(await report({ storeId: store.id, date: DATE }, staff), 403, ErrorCodes.FORBIDDEN);
    expectError(await report({ storeId: other.id, date: DATE }, staff), 403, ErrorCodes.FORBIDDEN);
    expectError(await report({ date: "bad" }, staff), 403, ErrorCodes.FORBIDDEN);
  });

  it("rejects requests without an admin token", async () => {
    const res = await request(app)
      .get(`${ADMIN_API}/reports/daily`)
      .query({ storeId: store.id, date: DATE });
    expectError(res, 401, ErrorCodes.INVALID_TOKEN);
  });
});
