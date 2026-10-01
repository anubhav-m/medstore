import { ErrorCodes, ORDER_TRANSITIONS, OrderStatus, TransitionActor } from "@medstore/shared";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../src/app.js";
import { Admin } from "../../../src/modules/admins/admin.model.js";
import { Order } from "../../../src/modules/orders/order.model.js";
import { adminApi, expectError, signInAdmin } from "../../helpers/admin.js";
import { ACTION_REQUESTS, runAction, seedStoreOrder } from "../../helpers/adminOrder.js";
import { registerAndVerify } from "../../helpers/auth.js";
import { onboardedCustomer } from "../../helpers/customer.js";
import { NOW, ensureOrderIndexes, mockStorageOk } from "../../helpers/order.js";
import { createTestStore, signInOwner, signInStaff } from "../../helpers/store.js";

vi.mock("../../../src/services/email.js", () => ({ sendCodeEmail: vi.fn() }));
vi.mock("../../../src/services/storage.js", () => ({
  verifyImageObject: vi.fn(),
  createSignedViewUrls: vi.fn(),
}));

let app;
let customer;
let storeA;
let storeB;
beforeAll(ensureOrderIndexes);
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  mockStorageOk();
  app = createApp();
  customer = await onboardedCustomer(app, "asha@example.com");
  storeA = await createTestStore();
  storeB = await createTestStore({ code: "ST02", name: "Second Store" });
});
afterEach(() => {
  vi.useRealTimers();
});

// Every admin order route, called as `api` for `orderId`.
const ROUTES = [
  ["GET /orders", (api) => api.get("/orders")],
  ["GET /orders/counts", (api) => api.get("/orders/counts")],
  ["GET /orders/:id", (api, orderId) => api.get(`/orders/${orderId}`)],
  ...Object.entries(ACTION_REQUESTS).map(([action, { path }]) => [
    `POST /orders/:id/${path} (${action})`,
    (api, orderId) => runAction(api, orderId, action),
  ]),
  ["GET /item-suggestions", (api) => api.get(`/item-suggestions?storeId=${storeA.id}&q=pa`)],
];

describe("who may call the admin order routes", () => {
  it.each(ROUTES)("%s rejects a customer token with 401 INVALID_TOKEN", async (_route, call) => {
    const { accessToken } = await registerAndVerify(app, "c@example.com");
    const order = await seedStoreOrder(customer, storeA);
    expectError(await call(adminApi(app, accessToken), order._id), 401, ErrorCodes.INVALID_TOKEN);
  });

  it.each(ROUTES)("%s rejects a missing token with 401 INVALID_TOKEN", async (_route, call) => {
    const order = await seedStoreOrder(customer, storeA);
    expectError(await call(adminApi(app, ""), order._id), 401, ErrorCodes.INVALID_TOKEN);
  });

  it.each(ROUTES)(
    "%s rejects an admin who must change their password with 403 PASSWORD_CHANGE_REQUIRED",
    async (_route, call) => {
      const { accessToken } = await signInAdmin(app, { mustChangePassword: true });
      const order = await seedStoreOrder(customer, storeA);
      expectError(
        await call(adminApi(app, accessToken), order._id),
        403,
        ErrorCodes.PASSWORD_CHANGE_REQUIRED,
      );
    },
  );

  it.each(ROUTES)(
    "%s rejects a disabled admin's valid token with 403 ACCOUNT_DISABLED",
    async (_route, call) => {
      const owner = await signInOwner(app);
      await Admin.updateMany({}, { $set: { isActive: false } });
      const order = await seedStoreOrder(customer, storeA);
      expectError(await call(owner, order._id), 403, ErrorCodes.ACCOUNT_DISABLED);
    },
  );
});

describe("store scope", () => {
  const staffActions = ORDER_TRANSITIONS.filter((t) => t.actor === TransitionActor.STAFF);

  it.each(staffActions.map((t) => [t.action, t.from[0]]))(
    "staff of store A get 404 ORDER_NOT_FOUND for %s on store B's order",
    async (action, status) => {
      const staff = await signInStaff(app, [storeA.code]);
      const order = await seedStoreOrder(customer, storeB, status);

      expectError(await runAction(staff, order._id, action), 404, ErrorCodes.ORDER_NOT_FOUND);
      const after = await Order.findById(order._id).lean();
      expect(after.status).toBe(status);
      expect(after.statusHistory).toHaveLength(order.statusHistory.length);
    },
  );

  it("staff of store A can't view store B's order", async () => {
    const staff = await signInStaff(app, [storeA.code]);
    const order = await seedStoreOrder(customer, storeB);
    expectError(await staff.get(`/orders/${order._id}`), 404, ErrorCodes.ORDER_NOT_FOUND);
  });

  it.each([
    ["the order list", (id) => `/orders?storeId=${id}`],
    ["the counts", (id) => `/orders/counts?storeId=${id}`],
    ["item suggestions", (id) => `/item-suggestions?storeId=${id}&q=pa`],
  ])("staff of store A get 404 STORE_NOT_FOUND passing store B to %s", async (_case, path) => {
    const staff = await signInStaff(app, [storeA.code]);
    expectError(await staff.get(path(storeB.id)), 404, ErrorCodes.STORE_NOT_FOUND);
  });

  it("staff of store A list and count only store A's orders", async () => {
    const staff = await signInStaff(app, [storeA.code]);
    const mine = await seedStoreOrder(customer, storeA);
    await seedStoreOrder(customer, storeB);
    await seedStoreOrder(customer, storeB);

    const list = await staff.get("/orders");
    expect(list.body.data.orders.map((order) => order.id)).toEqual([String(mine._id)]);
    expect(list.body.meta.total).toBe(1);
    expect((await staff.get("/orders/counts")).body.data.counts.NEW).toBe(1);
    expect((await staff.get(`/orders?storeId=${storeA.id}`)).status).toBe(200);
  });

  it("staff of both stores see both", async () => {
    const staff = await signInStaff(app, [storeA.code, storeB.code]);
    await seedStoreOrder(customer, storeA);
    await seedStoreOrder(customer, storeB);
    expect((await staff.get("/orders")).body.meta.total).toBe(2);
  });

  it("the owner can list, count, view and act on every store's orders", async () => {
    const owner = await signInOwner(app);
    await seedStoreOrder(customer, storeA);
    const order = await seedStoreOrder(customer, storeB, OrderStatus.CONFIRMED);

    expect((await owner.get("/orders")).body.meta.total).toBe(2);
    expect((await owner.get(`/orders?storeId=${storeB.id}`)).body.meta.total).toBe(1);
    expect((await owner.get(`/orders/counts?storeId=${storeB.id}`)).body.data.counts).toMatchObject(
      { NEW: 0, PREPARING: 1 },
    );
    expect((await owner.get(`/orders/${order._id}`)).status).toBe(200);
    expect((await owner.post(`/orders/${order._id}/pack`)).status).toBe(200);
    expect(
      (await owner.get(`/item-suggestions?storeId=${storeB.id}&q=pa`)).body.data.suggestions,
    ).toEqual(["Paracetamol 500"]);
  });
});
