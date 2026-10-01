import { ErrorCodes, MAX_ADDRESSES } from "@medstore/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../src/app.js";
import { Address } from "../../../src/modules/addresses/address.model.js";
import { expectError } from "../../helpers/admin.js";
import { ADDRESS, onboardedCustomer } from "../../helpers/customer.js";

vi.mock("../../../src/services/email.js", () => ({ sendCodeEmail: vi.fn() }));

const WORK = {
  label: "Work",
  line1: "Office 12",
  city: "Mumbai",
  pincode: "400001",
  lat: 18.93,
  lng: 72.83,
};

let api;
let firstAddress;
beforeEach(async () => {
  ({ api, address: firstAddress } = await onboardedCustomer(createApp(), "asha@example.com"));
});

const create = (body) => api.post("/addresses").send(body);
const defaultIds = async () =>
  (await Address.find({ isDefault: true }).lean()).map((address) => String(address._id));

const addUntil = async (total) => {
  for (let i = 1; i < total; i += 1) {
    expect((await create({ ...WORK, label: `Place ${i}` })).status).toBe(200);
  }
};

describe("POST /addresses", () => {
  it("saves a non-default address and returns it", async () => {
    const res = await create(WORK);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, message: "Address saved" });
    expect(res.body.data.address).toMatchObject({
      ...WORK,
      line2: null,
      landmark: null,
      isDefault: false,
    });
    expect(await defaultIds()).toEqual([firstAddress.id]);
  });

  it("stores lat 19.07, lng 72.87 as [72.87, 19.07] and returns the same lat / lng", async () => {
    const res = await create({ ...WORK, lat: 19.07, lng: 72.87 });

    expect(res.body.data.address).toMatchObject({ lat: 19.07, lng: 72.87 });
    const stored = await Address.findById(res.body.data.address.id).lean();
    expect(stored.location).toEqual({ type: "Point", coordinates: [72.87, 19.07] });

    const listed = (await api.get("/addresses")).body.data.addresses;
    expect(listed.find((address) => address.id === res.body.data.address.id)).toMatchObject({
      lat: 19.07,
      lng: 72.87,
    });
  });

  it("moves the default when isDefault is true", async () => {
    const res = await create({ ...WORK, isDefault: true });

    expect(res.body.data.address.isDefault).toBe(true);
    expect(await defaultIds()).toEqual([res.body.data.address.id]);
  });

  it("makes the address the default when the customer has none", async () => {
    await Address.deleteMany({});
    const res = await create({ ...WORK, isDefault: false });
    expect(res.body.data.address.isDefault).toBe(true);
  });

  it("lists the default first, then newest first", async () => {
    const second = (await create({ ...WORK, label: "Second" })).body.data.address;
    const third = (await create({ ...WORK, label: "Third" })).body.data.address;
    const res = await api.get("/addresses");

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Addresses loaded");
    expect(res.body.data.addresses.map((address) => address.id)).toEqual([
      firstAddress.id,
      third.id,
      second.id,
    ]);
  });

  it(`refuses address ${MAX_ADDRESSES + 1} with ADDRESS_LIMIT_REACHED`, async () => {
    await addUntil(MAX_ADDRESSES);
    expectError(await create(WORK), 409, ErrorCodes.ADDRESS_LIMIT_REACHED);
    expect(await Address.countDocuments()).toBe(MAX_ADDRESSES);
  });

  it(`lets only one of two simultaneous creates at ${MAX_ADDRESSES - 1} through`, async () => {
    await addUntil(MAX_ADDRESSES - 1);
    const results = await Promise.all([create(WORK), create({ ...WORK, isDefault: true })]);

    expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
    expect(await Address.countDocuments()).toBe(MAX_ADDRESSES);
    expect(await defaultIds()).toHaveLength(1);
  });

  it("is backed by a unique index that refuses a second default in the database", async () => {
    await Address.init();
    const { userId, location } = await Address.findById(firstAddress.id).lean();

    await expect(
      Address.create({ ...WORK, userId, location, isDefault: true }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it.each([
    ["outside India (London)", { lat: 51.5, lng: -0.12 }, "lat"],
    ["with lat and lng swapped", { lat: 72.87, lng: 19.07 }, "lat"],
    ["lat as a string", { lat: "19.07" }, "lat"],
    ["without lng", { lng: undefined }, "lng"],
    ["a pincode starting with 0", { pincode: "012345" }, "pincode"],
    ["a 5-digit pincode", { pincode: "40001" }, "pincode"],
    ["a pincode with letters", { pincode: "4000A1" }, "pincode"],
    ["a blank line1", { line1: "  " }, "line1"],
    ["a missing city", { city: undefined }, "city"],
    ["a missing label", { label: undefined }, "label"],
    ["a 31-character label", { label: "L".repeat(31) }, "label"],
    ["a 121-character line1", { line1: "L".repeat(121) }, "line1"],
    ["a 121-character line2", { line2: "L".repeat(121) }, "line2"],
    ["a 121-character landmark", { landmark: "L".repeat(121) }, "landmark"],
    ["a 61-character city", { city: "C".repeat(61) }, "city"],
    ["isDefault as a string", { isDefault: "true" }, "isDefault"],
  ])("rejects an address %s", async (_case, change, field) => {
    const res = await create({ ...ADDRESS, ...change });

    expectError(res, 400, ErrorCodes.VALIDATION_ERROR);
    expect(res.body.errors.map((error) => error.field)).toContain(field);
  });

  it.each([
    { userId: "64b000000000000000000000" },
    { location: { type: "Point", coordinates: [72.87, 19.07] } },
    { isBlocked: true },
    { _id: "64b000000000000000000000" },
  ])("rejects the extra field %o", async (extra) => {
    expectError(await create({ ...WORK, ...extra }), 400, ErrorCodes.VALIDATION_ERROR);
    expect(await Address.countDocuments()).toBe(1);
  });
});
