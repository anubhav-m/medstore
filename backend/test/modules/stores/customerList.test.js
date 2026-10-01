import { ErrorCodes } from "@medstore/shared";
import mongoose from "mongoose";
import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../src/app.js";
import { expectError, signInAdmin } from "../../helpers/admin.js";
import { API } from "../../helpers/auth.js";
import { onboardedCustomer, signedUpCustomer } from "../../helpers/customer.js";
import {
  createTestStore,
  eastOfAddress,
  ensureStoreIndexes,
  northOfAddress,
} from "../../helpers/store.js";

vi.mock("../../../src/services/email.js", () => ({ sendCodeEmail: vi.fn() }));

let app;
let customer;
beforeAll(ensureStoreIndexes);
// The clock is fixed before signing in, so access tokens are valid at the faked time.
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-02T06:30:00Z")); // 12:00 IST
  app = createApp();
  customer = await onboardedCustomer(app, "asha@example.com");
});
afterEach(() => {
  vi.useRealTimers();
});

const listStores = (addressId = customer.address.id, api = customer.api) =>
  api.get(`/stores?addressId=${addressId}`);

const byName = (res) =>
  Object.fromEntries(res.body.data.stores.map((store) => [store.name, store]));

describe("GET /stores?addressId=", () => {
  it("lists active stores nearest first with only their public fields", async () => {
    await createTestStore({ code: "FAR", name: "Far Store", ...northOfAddress(8) });
    await createTestStore({ code: "NEAR", name: "Near Store", ...northOfAddress(2) });

    const res = await listStores();

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Stores loaded");
    const [near, far] = res.body.data.stores;
    expect(near).toEqual({
      id: expect.any(String),
      name: "Near Store",
      address: {
        line1: "Shop 3, Hill Road",
        line2: "Bandra West",
        city: "Mumbai",
        pincode: "400050",
      },
      phone: "+912226401234",
      openingMinutes: 600,
      closingMinutes: 1320,
      deliveryFeePaise: 2500,
      distanceKm: 2,
      deliversToAddress: true,
      isOpen: true,
      nextOpensAt: null,
    });
    expect(far).toMatchObject({ name: "Far Store", distanceKm: 8, deliversToAddress: false });
  });

  it("decides delivery on the exact distance, not the rounded one", async () => {
    // Both round to 5.0 km; the radius is 5 km.
    await createTestStore({ code: "IN", name: "Just inside", ...northOfAddress(4.96) });
    await createTestStore({ code: "OUT", name: "Just outside", ...northOfAddress(5.04) });

    const stores = byName(await listStores());
    expect(stores["Just inside"]).toMatchObject({ distanceKm: 5, deliversToAddress: true });
    expect(stores["Just outside"]).toMatchObject({ distanceKm: 5, deliversToAddress: false });
  });

  it("measures north and east offsets alike, so lat and lng are never swapped", async () => {
    // Read as [lat, lng], a 3 km east offset would come out as ~3.2 km.
    await createTestStore({ code: "NORTH", name: "North", ...northOfAddress(3) });
    await createTestStore({ code: "EAST", name: "East", ...eastOfAddress(3) });

    const stores = byName(await listStores());
    expect(stores.North.distanceKm).toBe(3);
    expect(stores.East.distanceKm).toBe(3);
  });

  it("reports hours in IST: closed before opening with the next opening time", async () => {
    vi.setSystemTime(new Date("2026-10-02T18:45:00Z")); // 00:15 IST on the 3rd
    const night = await onboardedCustomer(app, "night@example.com");
    await createTestStore();

    const [store] = (await listStores(night.address.id, night.api)).body.data.stores;
    expect(store).toMatchObject({ isOpen: false, nextOpensAt: "2026-10-03T04:30:00.000Z" });
  });

  it("never lists inactive stores; lists paused ones as closed with no next opening", async () => {
    await createTestStore({ code: "OFF", name: "Inactive", isActive: false });
    await createTestStore({ code: "PAUSE", name: "Paused", isAcceptingOrders: false });

    const res = await listStores();
    expect(res.body.data.stores).toHaveLength(1);
    expect(res.body.data.stores[0]).toMatchObject({
      name: "Paused",
      isOpen: false,
      nextOpensAt: null,
    });
  });

  it("returns an empty list when there are no stores", async () => {
    const res = await listStores();
    expect(res.status).toBe(200);
    expect(res.body.data.stores).toEqual([]);
  });

  it("returns 404 ADDRESS_NOT_FOUND for another customer's address", async () => {
    await createTestStore();
    const other = await onboardedCustomer(app, "other@example.com");
    expectError(await listStores(other.address.id), 404, ErrorCodes.ADDRESS_NOT_FOUND);
  });

  it("returns 404 ADDRESS_NOT_FOUND for an unknown address id", async () => {
    const id = new mongoose.Types.ObjectId().toString();
    expectError(await listStores(id), 404, ErrorCodes.ADDRESS_NOT_FOUND);
  });

  it.each([
    ["a missing addressId", "/stores"],
    ["a malformed addressId", "/stores?addressId=not-an-id"],
    ["a repeated addressId", "/stores?addressId=1&addressId=2"],
  ])("rejects %s with 400 VALIDATION_ERROR", async (_case, path) => {
    expectError(await customer.api.get(path), 400, ErrorCodes.VALIDATION_ERROR);
  });

  it("rejects an unknown query key", async () => {
    const res = await customer.api.get(`/stores?addressId=${customer.address.id}&radius=100`);
    expectError(res, 400, ErrorCodes.VALIDATION_ERROR);
    expect(res.body.errors).toEqual([{ field: "radius", message: "This field is not allowed" }]);
  });

  it("returns 403 ONBOARDING_REQUIRED before onboarding", async () => {
    const api = await signedUpCustomer(app, "new@example.com");
    expectError(
      await api.get(`/stores?addressId=${customer.address.id}`),
      403,
      ErrorCodes.ONBOARDING_REQUIRED,
    );
  });

  it("requires a customer token: none or an admin's → 401 INVALID_TOKEN", async () => {
    const path = `${API}/stores?addressId=${customer.address.id}`;
    expectError(await request(app).get(path), 401, ErrorCodes.INVALID_TOKEN);

    const { accessToken } = await signInAdmin(app);
    const res = await request(app).get(path).set("Authorization", `Bearer ${accessToken}`);
    expectError(res, 401, ErrorCodes.INVALID_TOKEN);
  });
});
