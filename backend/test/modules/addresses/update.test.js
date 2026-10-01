import { ErrorCodes } from "@medstore/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../src/app.js";
import { Address } from "../../../src/modules/addresses/address.model.js";
import { expectError } from "../../helpers/admin.js";
import { ADDRESS, onboardedCustomer } from "../../helpers/customer.js";

vi.mock("../../../src/services/email.js", () => ({ sendCodeEmail: vi.fn() }));

let api;
let home;
let work;
beforeEach(async () => {
  ({ api, address: home } = await onboardedCustomer(createApp(), "asha@example.com"));
  work = (await api.post("/addresses").send({ ...ADDRESS, label: "Work" })).body.data.address;
});

const update = (id, body) => api.patch(`/addresses/${id}`).send(body);
const defaultIds = async () =>
  (await Address.find({ isDefault: true }).lean()).map((address) => String(address._id));

describe("PATCH /addresses/:id", () => {
  it("changes only the fields sent", async () => {
    const res = await update(work.id, { label: " Office ", pincode: "400001" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, message: "Address updated" });
    expect(res.body.data.address).toMatchObject({
      ...ADDRESS,
      label: "Office",
      pincode: "400001",
      isDefault: false,
    });
  });

  it("moves the pin, storing [lng, lat]", async () => {
    const res = await update(work.id, { lat: 28.61, lng: 77.21 });

    expect(res.body.data.address).toMatchObject({ lat: 28.61, lng: 77.21 });
    const stored = await Address.findById(work.id).lean();
    expect(stored.location.coordinates).toEqual([77.21, 28.61]);
  });

  it("clears line2 and landmark with null", async () => {
    const res = await update(work.id, { line2: null, landmark: null });
    expect(res.body.data.address).toMatchObject({ line2: null, landmark: null });
  });

  it("makes the address the default and unsets the old one", async () => {
    const res = await update(work.id, { isDefault: true });

    expect(res.body.data.address.isDefault).toBe(true);
    expect(await defaultIds()).toEqual([work.id]);
  });

  it("keeps one default when the default is set again", async () => {
    expect((await update(home.id, { isDefault: true })).status).toBe(200);
    expect(await defaultIds()).toEqual([home.id]);
  });

  it("keeps exactly one default under simultaneous default changes", async () => {
    const results = await Promise.all([
      update(work.id, { isDefault: true }),
      update(home.id, { isDefault: true }),
    ]);

    expect(results.map((res) => res.status)).toEqual([200, 200]);
    expect(await defaultIds()).toHaveLength(1);
  });

  it("refuses isDefault: false (the default can only be moved)", async () => {
    expectError(await update(home.id, { isDefault: false }), 400, ErrorCodes.VALIDATION_ERROR);
    expect(await defaultIds()).toEqual([home.id]);
  });

  it.each([
    ["lat without lng", { lat: 19.1 }],
    ["lng without lat", { lng: 72.9 }],
    ["a pin outside India", { lat: 40.71, lng: -74.0 }],
    ["an empty body", {}],
    ["a null label", { label: null }],
    ["a blank city", { city: " " }],
  ])("rejects %s with VALIDATION_ERROR", async (_case, body) => {
    expectError(await update(work.id, body), 400, ErrorCodes.VALIDATION_ERROR);
  });

  it.each([
    { userId: "64b000000000000000000000" },
    { location: { type: "Point", coordinates: [0, 0] } },
    { isBlocked: true },
    { createdAt: "2020-01-01T00:00:00.000Z" },
  ])("rejects the extra field %o and changes nothing", async (extra) => {
    const before = await Address.findById(work.id).lean();
    expectError(
      await update(work.id, { label: "Changed", ...extra }),
      400,
      ErrorCodes.VALIDATION_ERROR,
    );
    expect(await Address.findById(work.id).lean()).toEqual(before);
  });
});
