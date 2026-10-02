import { beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { ScriptError } from "../../scripts/lib/runAdminScript.js";
import { DEV_STORES, seedDevStores } from "../../scripts/lib/seedDevStores.js";
import { Store } from "../../src/modules/stores/store.model.js";
import { createTestStore, ensureStoreIndexes } from "../helpers/store.js";

const PIN = { lat: 12.9716, lng: 77.5946 };
const seed = (overrides = {}) => seedDevStores({ ...PIN, nodeEnv: "development", ...overrides });

const devStores = () =>
  Store.find(
    { code: /^DEV/ },
    {
      _id: 0,
      code: 1,
      deliveryRadiusKm: 1,
      openingMinutes: 1,
      closingMinutes: 1,
      isAcceptingOrders: 1,
      isActive: 1,
    },
  )
    .sort({ code: 1 })
    .lean();

// The brief's table; "00:00–24:00" stores close at 23:59 (24-hour stores aren't supported).
const EXPECTED = [
  ["DEV1", 0, 1439, 10, true],
  ["DEV2", 600, 1320, 5, true],
  ["DEV3", 180, 210, 5, true],
  ["DEV4", 0, 1439, 10, false],
  ["DEV5", 0, 1439, 0.5, true],
].map(([code, openingMinutes, closingMinutes, deliveryRadiusKm, isAcceptingOrders]) => ({
  code,
  deliveryRadiusKm,
  openingMinutes,
  closingMinutes,
  isAcceptingOrders,
  isActive: true,
}));

describe("seedDevStores", () => {
  beforeEach(ensureStoreIndexes);

  it("creates the five stores, and a second run updates them in place", async () => {
    const codes = DEV_STORES.map((store) => store.code);
    expect(await seed()).toEqual(codes.map((code) => ({ code, action: "created" })));
    expect(await seed()).toEqual(codes.map((code) => ({ code, action: "updated" })));

    expect(await devStores()).toEqual(EXPECTED);
  });

  it("resets an edited DEV store and leaves other stores alone", async () => {
    await createTestStore();
    await seed();
    await Store.updateOne(
      { code: "DEV2" },
      {
        isActive: false,
        isAcceptingOrders: false,
        deliveryRadiusKm: 1,
        location: { type: "Point", coordinates: [72, 19] },
      },
    );

    await seed();
    expect(await devStores()).toEqual(EXPECTED);
    expect(await Store.countDocuments()).toBe(6);
    expect(await Store.findOne({ code: "ST01" }).lean()).toMatchObject({
      isActive: true,
      deliveryRadiusKm: 5,
    });
    const dev2 = await Store.findOne({ code: "DEV2" }).lean();
    expect(dev2.location.coordinates).toEqual([expect.any(Number), expect.closeTo(PIN.lat, 4)]);
  });

  it("stores [lng, lat] at the intended distance and direction from the pin", async () => {
    await seed();
    const stores = await Store.aggregate([
      {
        $geoNear: {
          near: { type: "Point", coordinates: [PIN.lng, PIN.lat] },
          key: "location",
          distanceField: "distanceMeters",
          spherical: true,
          query: { code: /^DEV/ },
        },
      },
    ]);
    const byCode = new Map(stores.map((store) => [store.code, store]));

    for (const { code, km } of DEV_STORES) {
      expect(byCode.get(code).distanceMeters).toBeCloseTo(km * 1000, -1);
    }
    // DEV1 is due north (same lng, higher lat); DEV2 due east (higher lng, ~same lat).
    const [dev1Lng, dev1Lat] = byCode.get("DEV1").location.coordinates;
    expect(dev1Lng).toBeCloseTo(PIN.lng, 6);
    expect(dev1Lat).toBeGreaterThan(PIN.lat);
    const [dev2Lng, dev2Lat] = byCode.get("DEV2").location.coordinates;
    expect(dev2Lng).toBeGreaterThan(PIN.lng);
    expect(dev2Lat).toBeCloseTo(PIN.lat, 4);
  });

  it.each(["test", "production"])(
    "refuses when NODE_ENV is %s and writes nothing",
    async (nodeEnv) => {
      await expect(seed({ nodeEnv })).rejects.toBeInstanceOf(ScriptError);
      expect(await Store.countDocuments()).toBe(0);
    },
  );

  it("rejects a pin outside India and writes nothing", async () => {
    await expect(seed({ lat: 51.5, lng: -0.12 })).rejects.toBeInstanceOf(ZodError);
    expect(await Store.countDocuments()).toBe(0);
  });
});
