import { ErrorCodes } from "@medstore/shared";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../src/app.js";
import { Store } from "../../../src/modules/stores/store.model.js";
import { ADMIN_API, expectError } from "../../helpers/admin.js";
import { registerAndVerify } from "../../helpers/auth.js";
import {
  STORE,
  createTestStore,
  ensureStoreIndexes,
  signInOwner,
  signInStaff,
} from "../../helpers/store.js";

vi.mock("../../../src/services/email.js", () => ({ sendCodeEmail: vi.fn() }));

let app;
beforeAll(ensureStoreIndexes);
beforeEach(() => {
  app = createApp();
});

const expectFieldError = (res, field) => {
  expectError(res, 400, ErrorCodes.VALIDATION_ERROR);
  expect(res.body.errors.map((error) => error.field)).toContain(field);
};

describe("POST /admin/stores", () => {
  it("lets the owner create a store, normalising code and phone", async () => {
    const owner = await signInOwner(app);
    const res = await owner.post("/stores").send({ ...STORE, code: " st01 " });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Store created");
    expect(res.body.data.store).toEqual({
      id: expect.any(String),
      code: "ST01",
      name: STORE.name,
      address: STORE.address,
      phone: "+912226401234",
      lat: STORE.lat,
      lng: STORE.lng,
      deliveryRadiusKm: 5,
      openingMinutes: 600,
      closingMinutes: 1320,
      deliveryFeePaise: 2500,
      isAcceptingOrders: true,
      isActive: true,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    const stored = await Store.findById(res.body.data.store.id).lean();
    expect(stored.location).toEqual({ type: "Point", coordinates: [STORE.lng, STORE.lat] });
  });

  it("stores line2 as null when left out, and honours the flags", async () => {
    const owner = await signInOwner(app);
    // JSON drops undefined keys, so line2 is left out of the request.
    const address = { ...STORE.address, line2: undefined };
    const res = await owner
      .post("/stores")
      .send({ ...STORE, address, isActive: false, isAcceptingOrders: false });

    expect(res.body.data.store).toMatchObject({
      address: { ...STORE.address, line2: null },
      isActive: false,
      isAcceptingOrders: false,
    });
  });

  it.each([
    ["the smallest values", { deliveryRadiusKm: 0.5, deliveryFeePaise: 0, openingMinutes: 0 }],
    [
      "the largest values",
      { deliveryRadiusKm: 50, deliveryFeePaise: 100_000, closingMinutes: 1440 },
    ],
    ["one decimal of radius", { deliveryRadiusKm: 2.5 }],
    ["a mobile number", { phone: "+91 98765-43210" }],
  ])("accepts %s", async (_case, overrides) => {
    const owner = await signInOwner(app);
    expect((await owner.post("/stores").send({ ...STORE, ...overrides })).status).toBe(200);
  });

  it("returns 409 DUPLICATE_RESOURCE on code for a taken code in any case", async () => {
    await createTestStore();
    const owner = await signInOwner(app);
    const res = await owner.post("/stores").send({ ...STORE, code: "st01" });

    expectError(res, 409, ErrorCodes.DUPLICATE_RESOURCE);
    expect(res.body.errors).toEqual([{ field: "code", message: "Already exists" }]);
    expect(await Store.countDocuments()).toBe(1);
  });

  it.each([
    ["opening equal to closing", { openingMinutes: 600, closingMinutes: 600 }, "closingMinutes"],
    ["opening after closing", { openingMinutes: 1320, closingMinutes: 600 }, "closingMinutes"],
    ["a 24-hour store", { openingMinutes: 0, closingMinutes: 1440 }, "closingMinutes"],
    ["negative opening", { openingMinutes: -1 }, "openingMinutes"],
    ["closing past midnight", { closingMinutes: 1441 }, "closingMinutes"],
    ["fractional minutes", { openingMinutes: 600.5 }, "openingMinutes"],
    ["a radius below 0.5", { deliveryRadiusKm: 0.4 }, "deliveryRadiusKm"],
    ["a radius above 50", { deliveryRadiusKm: 50.1 }, "deliveryRadiusKm"],
    ["a radius with two decimals", { deliveryRadiusKm: 2.55 }, "deliveryRadiusKm"],
    ["a negative fee", { deliveryFeePaise: -1 }, "deliveryFeePaise"],
    ["a fee above the maximum", { deliveryFeePaise: 100_001 }, "deliveryFeePaise"],
    ["fractional paise", { deliveryFeePaise: 10.5 }, "deliveryFeePaise"],
    ["a latitude outside India", { lat: 5 }, "lat"],
    ["a longitude outside India", { lng: 98 }, "lng"],
    ["a one-character code", { code: "A" }, "code"],
    ["a seven-character code", { code: "ABCDEFG" }, "code"],
    ["a code with a dash", { code: "ST-1" }, "code"],
    ["a short phone", { phone: "12345" }, "phone"],
    ["a one-character name", { name: "A" }, "name"],
    [
      "a pincode starting with 0",
      { address: { ...STORE.address, pincode: "012345" } },
      "address.pincode",
    ],
    ["an unknown field", { isOpen: true }, "isOpen"],
  ])("rejects %s with 400 VALIDATION_ERROR", async (_case, overrides, field) => {
    const owner = await signInOwner(app);
    expectFieldError(await owner.post("/stores").send({ ...STORE, ...overrides }), field);
    expect(await Store.countDocuments()).toBe(0);
  });

  it("rejects a missing field", async () => {
    const owner = await signInOwner(app);
    const res = await owner.post("/stores").send({ ...STORE, phone: undefined });
    expectFieldError(res, "phone");
  });

  it("returns 403 FORBIDDEN for staff, whatever the body", async () => {
    await createTestStore();
    const staff = await signInStaff(app, ["ST01"]);

    expectError(
      await staff.post("/stores").send({ ...STORE, code: "ST02" }),
      403,
      ErrorCodes.FORBIDDEN,
    );
    expectError(await staff.post("/stores").send({}), 403, ErrorCodes.FORBIDDEN);
    expect(await Store.countDocuments()).toBe(1);
  });

  it("returns 401 INVALID_TOKEN for a customer token", async () => {
    const { accessToken } = await registerAndVerify(app, "asha@example.com");
    const res = await request(app)
      .post(`${ADMIN_API}/stores`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send(STORE);
    expectError(res, 401, ErrorCodes.INVALID_TOKEN);
  });
});
