import { randomUUID } from "node:crypto";
import { ErrorCodes, OrderStatus } from "@medstore/shared";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../src/app.js";
import { Order } from "../../../src/modules/orders/order.model.js";
import { Store } from "../../../src/modules/stores/store.model.js";
import { expectError } from "../../helpers/admin.js";
import { onboardedCustomer } from "../../helpers/customer.js";
import {
  NOW,
  billFields,
  ensureOrderIndexes,
  issueUpload,
  mockStorageOk,
  placeOrder,
  seedOrder,
} from "../../helpers/order.js";
import { createTestStore } from "../../helpers/store.js";

vi.mock("../../../src/services/email.js", () => ({ sendCodeEmail: vi.fn() }));
vi.mock("../../../src/services/storage.js", () => ({
  verifyImageObject: vi.fn(),
  createSignedViewUrls: vi.fn(),
}));

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

const newBody = async () => ({
  storeId: store.id,
  addressId: customer.address.id,
  imagePaths: [await issueUpload(customer.user.id)],
});

const orderCount = () => Order.countDocuments({ userId: customer.user.id });

const seedOpen = (count) =>
  Promise.all(
    Array.from({ length: count }, () => seedOrder({ userId: customer.user.id, storeId: store.id })),
  );

describe("Idempotency-Key", () => {
  it("returns the original order on a retry and stores only one", async () => {
    const key = randomUUID();
    const body = await newBody();
    const first = await placeOrder(customer.api, body, key);
    const retry = await placeOrder(customer.api, body, key);

    expect(retry.status).toBe(200);
    expect(retry.body.data.order).toEqual(first.body.data.order);
    expect(await orderCount()).toBe(1);
  });

  it("matches the key whatever its letter case", async () => {
    const key = randomUUID();
    const body = await newBody();
    const first = await placeOrder(customer.api, body, key);
    const retry = await placeOrder(customer.api, body, key.toUpperCase());

    expect(retry.body.data.order.id).toBe(first.body.data.order.id);
    expect(await orderCount()).toBe(1);
  });

  it("returns the original order for the same key with a different body (root 3.4)", async () => {
    const key = randomUUID();
    const first = await placeOrder(customer.api, await newBody(), key);
    const other = await placeOrder(
      customer.api,
      { ...(await newBody()), note: "something else" },
      key,
    );

    expect(other.status).toBe(200);
    expect(other.body.data.order.id).toBe(first.body.data.order.id);
    expect(other.body.data.order.customerNote).toBeNull();
    expect(await orderCount()).toBe(1);
  });

  it("returns the original order even after the store closes", async () => {
    const key = randomUUID();
    const body = await newBody();
    const first = await placeOrder(customer.api, body, key);
    await Store.updateOne({ _id: store.id }, { $set: { isAcceptingOrders: false } });

    const retry = await placeOrder(customer.api, body, key);
    expect(retry.status).toBe(200);
    expect(retry.body.data.order.id).toBe(first.body.data.order.id);
  });

  it("keeps each customer's keys separate", async () => {
    const key = randomUUID();
    const other = await onboardedCustomer(app, "b@example.com");
    const mine = await placeOrder(customer.api, await newBody(), key);
    const theirs = await placeOrder(
      other.api,
      {
        storeId: store.id,
        addressId: other.address.id,
        imagePaths: [await issueUpload(other.user.id)],
      },
      key,
    );

    expect(theirs.status).toBe(200);
    expect(theirs.body.data.order.id).not.toBe(mine.body.data.order.id);
  });

  it("creates one order for 5 simultaneous identical requests and returns it to all", async () => {
    const key = randomUUID();
    const body = await newBody();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => placeOrder(customer.api, body, key)),
    );

    expect(results.map((res) => res.status)).toEqual([200, 200, 200, 200, 200]);
    expect(new Set(results.map((res) => res.body.data.order.id)).size).toBe(1);
    expect(await orderCount()).toBe(1);
  });

  it("returns the winner's order to a simultaneous same-key request at 2 open orders", async () => {
    await seedOpen(2);
    const key = randomUUID();
    const body = await newBody();
    const results = await Promise.all([
      placeOrder(customer.api, body, key),
      placeOrder(customer.api, body, key),
    ]);

    expect(results.map((res) => res.status)).toEqual([200, 200]);
    expect(results[0].body.data.order.id).toBe(results[1].body.data.order.id);
    expect(await orderCount()).toBe(3);
  });
});

describe("open-order limit", () => {
  it("allows 3 orders in progress, then returns 409 TOO_MANY_OPEN_ORDERS", async () => {
    for (let index = 0; index < 3; index += 1) {
      expect((await placeOrder(customer.api, await newBody())).status).toBe(200);
    }
    expectError(
      await placeOrder(customer.api, await newBody()),
      409,
      ErrorCodes.TOO_MANY_OPEN_ORDERS,
    );
  });

  it("doesn't count terminal orders", async () => {
    for (const status of [
      OrderStatus.REJECTED,
      OrderStatus.CANCELLED,
      OrderStatus.DELIVERED,
      OrderStatus.DELIVERY_FAILED,
    ]) {
      await seedOrder({ userId: customer.user.id, storeId: store.id, status });
    }
    await seedOpen(2);
    expect((await placeOrder(customer.api, await newBody())).status).toBe(200);
  });

  it("counts every non-terminal status", async () => {
    await seedOrder({ userId: customer.user.id, storeId: store.id, status: OrderStatus.PACKED });
    await seedOrder({
      userId: customer.user.id,
      storeId: store.id,
      status: OrderStatus.OUT_FOR_DELIVERY,
    });
    await seedOrder({
      userId: customer.user.id,
      storeId: store.id,
      status: OrderStatus.AWAITING_CONFIRMATION,
      ...billFields(),
    });
    expectError(
      await placeOrder(customer.api, await newBody()),
      409,
      ErrorCodes.TOO_MANY_OPEN_ORDERS,
    );
  });

  it("lets exactly 3 of 5 simultaneous creates through", async () => {
    const bodies = await Promise.all(Array.from({ length: 5 }, newBody));
    const results = await Promise.all(bodies.map((body) => placeOrder(customer.api, body)));

    expect(results.map((res) => res.status).sort()).toEqual([200, 200, 200, 409, 409]);
    for (const res of results.filter((r) => r.status === 409)) {
      expect(res.body.code).toBe(ErrorCodes.TOO_MANY_OPEN_ORDERS);
    }
    expect(await orderCount()).toBe(3);
  });

  it("lets only one of two simultaneous creates through at 2 open orders", async () => {
    await seedOpen(2);
    const results = await Promise.all([
      placeOrder(customer.api, await newBody()),
      placeOrder(customer.api, await newBody()),
    ]);

    expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
    expect(await orderCount()).toBe(3);
  });

  it("frees a slot when an order is cancelled", async () => {
    const first = await placeOrder(customer.api, await newBody());
    await seedOpen(2);
    expectError(
      await placeOrder(customer.api, await newBody()),
      409,
      ErrorCodes.TOO_MANY_OPEN_ORDERS,
    );

    const cancel = await customer.api.post(`/orders/${first.body.data.order.id}/cancel`).send({});
    expect(cancel.status).toBe(200);
    expect((await placeOrder(customer.api, await newBody())).status).toBe(200);
  });

  it("counts each customer separately", async () => {
    await seedOpen(3);
    const other = await onboardedCustomer(app, "b@example.com");
    const res = await placeOrder(other.api, {
      storeId: store.id,
      addressId: other.address.id,
      imagePaths: [await issueUpload(other.user.id)],
    });
    expect(res.status).toBe(200);
  });
});
