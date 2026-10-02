import { MINUTES_PER_DAY } from "@medstore/shared";
import { Store } from "../../src/modules/stores/store.model.js";
import { createStore, updateStore } from "../../src/modules/stores/store.service.js";
import { createStoreSchema } from "../../src/modules/stores/store.validation.js";
import { ScriptError } from "./runAdminScript.js";

// MongoDB's spherical distances use this Earth radius, so $geoNear reports the intended km.
const EARTH_RADIUS_KM = 6378.1;
const toRadians = (degrees) => (degrees * Math.PI) / 180;
const toDegrees = (radians) => (radians * 180) / Math.PI;

// Great-circle destination from (lat, lng) after `km` on `bearingDegrees` (0 = north, 90 = east).
const pointAt = ({ lat, lng }, km, bearingDegrees) => {
  const angle = km / EARTH_RADIUS_KM;
  const bearing = toRadians(bearingDegrees);
  const lat1 = toRadians(lat);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angle) + Math.cos(lat1) * Math.sin(angle) * Math.cos(bearing),
  );
  const lng2 =
    toRadians(lng) +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angle) * Math.cos(lat1),
      Math.cos(angle) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { lat: toDegrees(lat2), lng: toDegrees(lng2) };
};

// 24-hour stores aren't supported (root 3.3), so "always open" closes at 23:59 IST.
const ALL_DAY = { openingMinutes: 0, closingMinutes: MINUTES_PER_DAY - 1 };

export const DEV_STORES = [
  {
    code: "DEV1",
    purpose: "Always open",
    km: 1,
    bearing: 0,
    ...ALL_DAY,
    radiusKm: 10,
    accepting: true,
  },
  {
    code: "DEV2",
    purpose: "Normal hours",
    km: 2,
    bearing: 90,
    openingMinutes: 600,
    closingMinutes: 1320,
    radiusKm: 5,
    accepting: true,
  },
  {
    code: "DEV3",
    purpose: "Closed almost all day",
    km: 2,
    bearing: 180,
    openingMinutes: 180,
    closingMinutes: 210,
    radiusKm: 5,
    accepting: true,
  },
  {
    code: "DEV4",
    purpose: "Paused",
    km: 1.5,
    bearing: 270,
    ...ALL_DAY,
    radiusKm: 10,
    accepting: false,
  },
  {
    code: "DEV5",
    purpose: "Too far",
    km: 3,
    bearing: 45,
    ...ALL_DAY,
    radiusKm: 0.5,
    accepting: true,
  },
];

const toStoreBody = (store, index, pin) => ({
  code: store.code,
  name: `${store.code} · ${store.purpose}`,
  address: { line1: `Dev store ${index + 1}`, city: "Dev City", pincode: "110001" },
  phone: `900000000${index + 1}`,
  ...pointAt(pin, store.km, store.bearing),
  deliveryRadiusKm: store.radiusKm,
  openingMinutes: store.openingMinutes,
  closingMinutes: store.closingMinutes,
  deliveryFeePaise: 2000,
  isAcceptingOrders: store.accepting,
  isActive: true,
});

// Creates or resets DEV1–DEV5 around the pin through the real store validation and service.
// Touches nothing but those five stores and never deletes.
export const seedDevStores = async ({ lat, lng, nodeEnv }) => {
  if (nodeEnv !== "development") {
    throw new ScriptError(`Refusing to seed: NODE_ENV is "${nodeEnv}", not "development".`);
  }
  // Parse every body first, so a bad pin writes nothing.
  const bodies = DEV_STORES.map((store, index) =>
    createStoreSchema.body.parse(toStoreBody(store, index, { lat, lng })),
  );
  const existing = await Store.find(
    { code: { $in: DEV_STORES.map((store) => store.code) } },
    { code: 1 },
  ).lean();
  const idByCode = new Map(existing.map((store) => [store.code, store._id]));

  const results = [];
  for (const { code, ...fields } of bodies) {
    const id = idByCode.get(code);
    if (id) await updateStore(id, fields);
    else await createStore({ code, ...fields });
    results.push({ code, action: id ? "updated" : "created" });
  }
  return results;
};
