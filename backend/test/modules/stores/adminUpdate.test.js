import { ErrorCodes } from "@medstore/shared";
import mongoose from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../src/app.js";
import { Store } from "../../../src/modules/stores/store.model.js";
import { expectError } from "../../helpers/admin.js";
import { STORE, createTestStore, signInOwner, signInStaff } from "../../helpers/store.js";

vi.mock("../../../src/services/email.js", () => ({ sendCodeEmail: vi.fn() }));

let app;
let store;
let owner;
beforeEach(async () => {
  app = createApp();
  store = await createTestStore();
  owner = await signInOwner(app);
});

const patch = (api, body, id = store.id) => api.patch(`/stores/${id}`).send(body);

const expectFieldError = (res, field) => {
  expectError(res, 400, ErrorCodes.VALIDATION_ERROR);
  expect(res.body.errors.map((error) => error.field)).toContain(field);
};

const expectUnchanged = async () => {
  const stored = await Store.findById(store.id).lean();
  expect(stored).toMatchObject({
    code: STORE.code,
    name: STORE.name,
    openingMinutes: STORE.openingMinutes,
    closingMinutes: STORE.closingMinutes,
  });
};

describe("PATCH /admin/stores/:id", () => {
  it("changes only the fields sent", async () => {
    const res = await patch(owner, { name: "Hill Road Pharmacy", isAcceptingOrders: false });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Store updated");
    // Compared as JSON: the response carries dates as ISO strings.
    expect(res.body.data.store).toEqual({
      ...JSON.parse(JSON.stringify(store)),
      name: "Hill Road Pharmacy",
      isAcceptingOrders: false,
      updatedAt: expect.any(String),
    });
  });

  it("changes hours, radius, fee and location, storing [lng, lat]", async () => {
    const changes = {
      openingMinutes: 480,
      closingMinutes: 1380,
      deliveryRadiusKm: 7.5,
      deliveryFeePaise: 0,
      lat: 18.52,
      lng: 73.85,
    };
    const res = await patch(owner, changes);

    expect(res.body.data.store).toMatchObject(changes);
    const stored = await Store.findById(store.id).lean();
    expect(stored.location.coordinates).toEqual([73.85, 18.52]);
  });

  it("replaces the whole address, so leaving out line2 clears it", async () => {
    const address = { line1: "Shop 9, Linking Road", city: "Mumbai", pincode: "400052" };
    const res = await patch(owner, { address });
    expect(res.body.data.store.address).toEqual({ ...address, line2: null });
  });

  it("rejects code with 400 and leaves it unchanged, even when it is the same code", async () => {
    expectFieldError(await patch(owner, { code: "ST99" }), "code");
    expectFieldError(await patch(owner, { code: STORE.code, name: "New Name" }), "code");
    await expectUnchanged();
  });

  it.each([
    ["only openingMinutes", { openingMinutes: 500 }, "closingMinutes"],
    ["only closingMinutes", { closingMinutes: 1400 }, "closingMinutes"],
    ["opening equal to closing", { openingMinutes: 700, closingMinutes: 700 }, "closingMinutes"],
    ["opening after closing", { openingMinutes: 1300, closingMinutes: 700 }, "closingMinutes"],
    ["a 24-hour store", { openingMinutes: 0, closingMinutes: 1440 }, "closingMinutes"],
    ["only lat", { lat: 19 }, "lng"],
    ["a radius above 50", { deliveryRadiusKm: 51 }, "deliveryRadiusKm"],
    ["a fee above the maximum", { deliveryFeePaise: 100_001 }, "deliveryFeePaise"],
    ["a null name", { name: null }, "name"],
    ["an unknown field", { distanceKm: 1 }, "distanceKm"],
  ])("rejects %s with 400 VALIDATION_ERROR", async (_case, body, field) => {
    expectFieldError(await patch(owner, body), field);
    await expectUnchanged();
  });

  it("rejects an empty body", async () => {
    expectError(await patch(owner, {}), 400, ErrorCodes.VALIDATION_ERROR);
  });

  it("returns 404 STORE_NOT_FOUND for an unknown id", async () => {
    const id = new mongoose.Types.ObjectId().toString();
    expectError(await patch(owner, { name: "Ghost" }, id), 404, ErrorCodes.STORE_NOT_FOUND);
  });

  it("returns 400 INVALID_ID for a malformed id", async () => {
    expectError(await patch(owner, { name: "Ghost" }, "not-an-id"), 400, ErrorCodes.INVALID_ID);
  });

  it("returns 403 FORBIDDEN for staff, even of that store", async () => {
    const staff = await signInStaff(app, [STORE.code]);
    expectError(await patch(staff, { name: "Staff Rename" }), 403, ErrorCodes.FORBIDDEN);
    await expectUnchanged();
  });
});
