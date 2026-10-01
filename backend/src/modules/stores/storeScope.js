import { AdminRole } from "@medstore/shared";
import { Store } from "./store.model.js";

// Bounds the owner's scope query; stores are a handful.
export const MAX_STORES = 500;

// The ids of the stores an admin may act on (backend 6): every store for an owner, including
// inactive ones; the assigned stores for staff. `admin` is req.admin.
export const getStoreScope = async (admin) => {
  if (admin.role !== AdminRole.OWNER) return admin.storeIds;
  const stores = await Store.find({}, { _id: 1 }).limit(MAX_STORES).lean();
  return stores.map((store) => store._id);
};
