import { BLOCK_REASON_MAX_LENGTH, ErrorCodes } from "@medstore/shared";
import mongoose from "mongoose";
import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../src/app.js";
import { User } from "../../../src/modules/users/user.model.js";
import { ADMIN_API, expectError } from "../../helpers/admin.js";
import { login } from "../../helpers/auth.js";
import { onboardedCustomer } from "../../helpers/customer.js";
import {
  NOW,
  ensureOrderIndexes,
  issueUpload,
  mockStorageOk,
  placeOrder,
} from "../../helpers/order.js";
import { createTestStore, northOfAddress, signInOwner, signInStaff } from "../../helpers/store.js";

vi.mock("../../../src/services/email.js", () => ({ sendCodeEmail: vi.fn() }));
vi.mock("../../../src/services/storage.js", () => ({
  verifyImageObject: vi.fn(),
  createSignedViewUrls: vi.fn(),
}));

const EMAIL = "asha@example.com";

let app;
let owner;
let customer;
let store;
beforeAll(ensureOrderIndexes);
// The clock is fixed before signing in, so access tokens are valid at the faked time and the
// store (10:00–22:00 IST) is open.
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  mockStorageOk();
  app = createApp();
  owner = await signInOwner(app);
  customer = await onboardedCustomer(app, EMAIL);
  store = await createTestStore({ ...northOfAddress(2) });
});
afterEach(() => {
  vi.useRealTimers();
});

const setBlocked = (body, id = customer.user.id, api = owner) =>
  api.patch(`/customers/${id}/block`).send(body);

const storedBlock = () =>
  User.findById(customer.user.id, {
    isBlocked: 1,
    blockedAt: 1,
    blockedBy: 1,
    blockReason: 1,
    _id: 0,
  }).lean();

const order = async () =>
  placeOrder(customer.api, {
    storeId: store.id,
    addressId: customer.address.id,
    imagePaths: [await issueUpload(customer.user.id)],
  });

const ownerId = async () => {
  const res = await owner.get("/me");
  return res.body.data.admin.id;
};

describe("PATCH /admin/customers/:id/block", () => {
  it("blocks with a reason, recording who and when, and returns only the block state", async () => {
    const res = await setBlocked({ isBlocked: true, reason: "  Fake prescriptions  " });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Customer blocked");
    expect(res.body.data).toEqual({
      customer: {
        id: customer.user.id,
        isBlocked: true,
        blockedAt: NOW.toISOString(),
        blockReason: "Fake prescriptions",
      },
    });
    expect(await storedBlock()).toEqual({
      isBlocked: true,
      blockedAt: NOW,
      blockedBy: new mongoose.Types.ObjectId(await ownerId()),
      blockReason: "Fake prescriptions",
    });
  });

  it("blocks without a reason", async () => {
    const res = await setBlocked({ isBlocked: true });
    expect(res.status).toBe(200);
    expect(res.body.data.customer).toMatchObject({ isBlocked: true, blockReason: null });
  });

  it("unblocks and clears the block fields", async () => {
    await setBlocked({ isBlocked: true, reason: "Abuse" });

    const res = await setBlocked({ isBlocked: false });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Customer unblocked");
    expect(res.body.data.customer).toEqual({
      id: customer.user.id,
      isBlocked: false,
      blockedAt: null,
      blockReason: null,
    });
    expect(await storedBlock()).toEqual({
      isBlocked: false,
      blockedAt: null,
      blockedBy: null,
      blockReason: null,
    });
  });

  it("stops a blocked customer's orders with 403 ACCOUNT_BLOCKED until they are unblocked", async () => {
    await setBlocked({ isBlocked: true });
    expectError(await order(), 403, ErrorCodes.ACCOUNT_BLOCKED);

    await setBlocked({ isBlocked: false });
    const res = await order();
    expect(res.status).toBe(200);
  });

  it("still lets a blocked customer sign in and see their orders, without the reason", async () => {
    await setBlocked({ isBlocked: true, reason: "Abuse" });

    expect((await login(app, EMAIL)).status).toBe(200);
    expect((await customer.api.get("/orders")).status).toBe(200);
    const me = await customer.api.get("/me");
    expect(me.body.data.user.isBlocked).toBe(true);
    expect(JSON.stringify(me.body)).not.toContain("Abuse");
  });

  it("returns 404 CUSTOMER_NOT_FOUND for an unknown customer", async () => {
    const id = String(new mongoose.Types.ObjectId());
    expectError(await setBlocked({ isBlocked: true }, id), 404, ErrorCodes.CUSTOMER_NOT_FOUND);
  });

  it("returns 400 INVALID_ID for a malformed id", async () => {
    expectError(await setBlocked({ isBlocked: true }, "nope"), 400, ErrorCodes.INVALID_ID);
  });

  it.each([
    ["a missing isBlocked", {}, "isBlocked"],
    ["a string isBlocked", { isBlocked: "true" }, "isBlocked"],
    ["a reason when unblocking", { isBlocked: false, reason: "Sorry" }, "reason"],
    ["an empty reason", { isBlocked: true, reason: "   " }, "reason"],
    [
      "a reason that is too long",
      { isBlocked: true, reason: "x".repeat(BLOCK_REASON_MAX_LENGTH + 1) },
      "reason",
    ],
    ["an unknown key", { isBlocked: true, blockedBy: "me" }, "blockedBy"],
  ])("returns 400 VALIDATION_ERROR for %s", async (_label, body, field) => {
    const res = await setBlocked(body);
    expectError(res, 400, ErrorCodes.VALIDATION_ERROR);
    expect(res.body.errors.map((error) => error.field)).toContain(field);
    expect((await storedBlock()).isBlocked).toBe(false);
  });

  it("returns 403 FORBIDDEN to staff, whatever they send", async () => {
    const staff = await signInStaff(app, ["ST01"]);

    expectError(await setBlocked({ isBlocked: true }, undefined, staff), 403, ErrorCodes.FORBIDDEN);
    expectError(await setBlocked({}, "nope", staff), 403, ErrorCodes.FORBIDDEN);
    expect((await storedBlock()).isBlocked).toBe(false);
  });

  it("rejects a customer token", async () => {
    const token = (await login(app, EMAIL)).body.data.accessToken;
    const res = await request(app)
      .patch(`${ADMIN_API}/customers/${customer.user.id}/block`)
      .set("Authorization", `Bearer ${token}`)
      .send({ isBlocked: false });
    expectError(res, 401, ErrorCodes.INVALID_TOKEN);
  });
});
