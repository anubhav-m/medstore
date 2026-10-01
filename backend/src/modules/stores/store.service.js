import { ErrorCodes } from "@medstore/shared";
import mongoose from "mongoose";
import { AppError } from "../../utils/AppError.js";
import { fromPoint, toPoint } from "../../utils/geo.js";
import { Address } from "../addresses/address.model.js";
import { addressNotFound } from "../addresses/address.service.js";
import { Store } from "./store.model.js";
import { isStoreOpen, nextOpensAt } from "./storeHours.js";
import { MAX_STORES, getStoreScope } from "./storeScope.js";

const toStoreAddress = ({ line1, line2, city, pincode }) => ({
  line1,
  line2: line2 ?? null,
  city,
  pincode,
});

const toAdminStore = (store) => ({
  id: String(store._id),
  code: store.code,
  name: store.name,
  address: toStoreAddress(store.address),
  phone: store.phone,
  ...fromPoint(store.location),
  deliveryRadiusKm: store.deliveryRadiusKm,
  openingMinutes: store.openingMinutes,
  closingMinutes: store.closingMinutes,
  deliveryFeePaise: store.deliveryFeePaise,
  isAcceptingOrders: store.isAcceptingOrders,
  isActive: store.isActive,
  createdAt: store.createdAt,
  updatedAt: store.updatedAt,
});

// `store.distanceMeters` comes from $geoNear. Eligibility uses the exact distance; only the
// displayed (and copied) value is rounded to one decimal.
export const deliversTo = (store) => store.distanceMeters <= store.deliveryRadiusKm * 1000;

export const toDistanceKm = (meters) => Math.round(meters / 100) / 10;

// Public fields only.
const toCustomerStore = (store, now) => ({
  id: String(store._id),
  name: store.name,
  address: toStoreAddress(store.address),
  phone: store.phone,
  openingMinutes: store.openingMinutes,
  closingMinutes: store.closingMinutes,
  deliveryFeePaise: store.deliveryFeePaise,
  distanceKm: toDistanceKm(store.distanceMeters),
  deliversToAddress: deliversTo(store),
  isOpen: isStoreOpen(store, now),
  nextOpensAt: nextOpensAt(store, now),
});

// Validation guarantees lat and lng arrive together. The address is replaced as a whole.
const toStoreFields = ({ lat, lng, address, ...fields }) => ({
  ...fields,
  ...(lat !== undefined && { location: toPoint({ lat, lng }) }),
  ...(address && { address: toStoreAddress(address) }),
});

const scopedStores = async (admin, projection) =>
  Store.find({ _id: { $in: await getStoreScope(admin) } }, projection)
    .sort({ code: 1 })
    .limit(MAX_STORES)
    .lean();

// Active stores nearest first, measured from the address pin (root 3.3).
export const listStoresForAddress = async (userId, addressId) => {
  const address = await Address.findOne({ _id: addressId, userId }, { location: 1 }).lean();
  if (!address) throw addressNotFound();

  const stores = await Store.aggregate([
    {
      $geoNear: {
        near: address.location,
        key: "location",
        distanceField: "distanceMeters",
        spherical: true,
        query: { isActive: true },
      },
    },
    { $limit: MAX_STORES },
  ]);
  const now = new Date();
  return stores.map((store) => toCustomerStore(store, now));
};

// One store (any state) with its straight-line distance from `point` (GeoJSON); null if it
// doesn't exist. Aggregation stages aren't cast by Mongoose, hence the explicit ObjectId.
export const findStoreForPin = async (storeId, point) => {
  const [store] = await Store.aggregate([
    {
      $geoNear: {
        near: point,
        key: "location",
        distanceField: "distanceMeters",
        spherical: true,
        query: { _id: new mongoose.Types.ObjectId(String(storeId)) },
      },
    },
  ]);
  return store ?? null;
};

export const listAdminStores = async (admin) => (await scopedStores(admin)).map(toAdminStore);

export const listStoreSummaries = async (admin) =>
  (await scopedStores(admin, { code: 1, name: 1 })).map((store) => ({
    id: String(store._id),
    code: store.code,
    name: store.name,
  }));

// A taken code is a duplicate-key error, which the error handler reports on `code`.
export const createStore = async (input) => {
  const store = await Store.create(toStoreFields(input));
  return toAdminStore(store.toObject());
};

export const updateStore = async (storeId, input) => {
  const store = await Store.findByIdAndUpdate(
    storeId,
    { $set: toStoreFields(input) },
    { returnDocument: "after", runValidators: true },
  ).lean();
  if (!store) throw new AppError("Store not found", 404, ErrorCodes.STORE_NOT_FOUND);
  return toAdminStore(store);
};

// Ids in the order of `codes` (uppercase). Inactive stores can be assigned.
export const resolveStoreCodes = async (codes) => {
  const stores = await Store.find({ code: { $in: codes } }, { code: 1 }).lean();
  const idByCode = new Map(stores.map((store) => [store.code, store._id]));
  const unknown = codes.filter((code) => !idByCode.has(code));
  if (unknown.length > 0) {
    throw new AppError(
      `No store with the code ${unknown.join(", ")}`,
      404,
      ErrorCodes.STORE_NOT_FOUND,
    );
  }
  return codes.map((code) => idByCode.get(code));
};
