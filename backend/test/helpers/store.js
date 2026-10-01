import { AdminRole } from "@medstore/shared";
import { Store } from "../../src/modules/stores/store.model.js";
import { createStore } from "../../src/modules/stores/store.service.js";
import { createStoreSchema } from "../../src/modules/stores/store.validation.js";
import { adminApi, signInAdmin } from "./admin.js";
import { ADDRESS } from "./customer.js";

// MongoDB's spherical distances use an Earth radius of 6378.1 km.
const KM_PER_DEGREE = (6378.1 * Math.PI) / 180;

// A pin `km` due north / east of the customer test address.
export const northOfAddress = (km) => ({ lat: ADDRESS.lat + km / KM_PER_DEGREE, lng: ADDRESS.lng });
export const eastOfAddress = (km) => ({
  lat: ADDRESS.lat,
  lng: ADDRESS.lng + km / (KM_PER_DEGREE * Math.cos((ADDRESS.lat * Math.PI) / 180)),
});

// 10:00–22:00 IST, 5 km radius, ₹25 delivery.
export const STORE = {
  code: "ST01",
  name: "Hill Road Medical",
  address: { line1: "Shop 3, Hill Road", line2: "Bandra West", city: "Mumbai", pincode: "400050" },
  phone: "022-2640 1234",
  lat: 19.07,
  lng: 72.87,
  deliveryRadiusKm: 5,
  openingMinutes: 600,
  closingMinutes: 1320,
  deliveryFeePaise: 2500,
};

// The unique and 2dsphere indexes must exist before duplicate-code and $geoNear tests run.
export const ensureStoreIndexes = () => Store.init();

// Parsed like a request body, so stored values match what the API would store.
export const createTestStore = (overrides = {}) =>
  createStore(createStoreSchema.body.parse({ ...STORE, ...overrides }));

export const signInOwner = async (app) => adminApi(app, (await signInAdmin(app)).accessToken);

export const signInStaff = async (app, storeCodes, username = "staff.one") => {
  const session = await signInAdmin(app, {
    username,
    name: "Staff One",
    role: AdminRole.STAFF,
    storeCodes,
  });
  return adminApi(app, session.accessToken);
};
