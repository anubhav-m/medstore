import { ErrorCodes, MAX_OPEN_ORDERS, OrderAction, OrderStatus } from "@medstore/shared";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../src/app.js";
import { expectError } from "../../helpers/admin.js";
import { runAction, seedStoreOrder } from "../../helpers/adminOrder.js";
import { onboardedCustomer } from "../../helpers/customer.js";
import {
  NOW,
  ensureOrderIndexes,
  issueUpload,
  mockStorageOk,
  placeOrder,
} from "../../helpers/order.js";
import { createTestStore, signInStaff } from "../../helpers/store.js";

vi.mock("../../../src/services/email.js", () => ({ sendCodeEmail: vi.fn() }));
vi.mock("../../../src/services/storage.js", () => ({
  verifyImageObject: vi.fn(),
  createSignedViewUrls: vi.fn(),
}));

const S = OrderStatus;

let app;
let customer;
let store;
let staff;
beforeAll(ensureOrderIndexes);
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

const place = async () =>
  placeOrder(customer.api, {
    storeId: store.id,
    addressId: customer.address.id,
    imagePaths: [await issueUpload(customer.user.id)],
  });

// Open orders are counted, not stored (root 3.4), so a staff action that ends an order frees a
// slot for the next one.
describe("open orders after staff actions", () => {
  it.each([
    [OrderAction.REJECT, S.PENDING_REVIEW],
    [OrderAction.STAFF_CANCEL, S.PACKED],
    [OrderAction.DELIVER, S.OUT_FOR_DELIVERY],
    [OrderAction.FAIL_DELIVERY, S.OUT_FOR_DELIVERY],
  ])("%s frees a slot for a customer at the limit", async (action, status) => {
    const target = await seedStoreOrder(customer, store, status);
    for (let index = 1; index < MAX_OPEN_ORDERS; index += 1) {
      await seedStoreOrder(customer, store, S.CONFIRMED);
    }
    expectError(await place(), 409, ErrorCodes.TOO_MANY_OPEN_ORDERS);

    expect((await runAction(staff, target._id, action)).status).toBe(200);

    expect((await place()).status).toBe(200);
  });

  it.each([
    [OrderAction.SEND_BILL, S.PENDING_REVIEW],
    [OrderAction.PACK, S.CONFIRMED],
    [OrderAction.DISPATCH, S.PACKED],
  ])("%s keeps the order open", async (action, status) => {
    const target = await seedStoreOrder(customer, store, status);
    for (let index = 1; index < MAX_OPEN_ORDERS; index += 1) {
      await seedStoreOrder(customer, store, S.CONFIRMED);
    }

    expect((await runAction(staff, target._id, action)).status).toBe(200);

    expectError(await place(), 409, ErrorCodes.TOO_MANY_OPEN_ORDERS);
  });
});
