import { Router } from "express";
import { authCustomer } from "../../middleware/authCustomer.js";
import { requireOnboarded } from "../../middleware/requireOnboarded.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./store.controller.js";
import * as schemas from "./store.validation.js";

// Mounted at /stores.
export const storeRoutes = Router();

storeRoutes.get(
  "/",
  authCustomer,
  requireOnboarded,
  validate(schemas.listCustomerStoresSchema),
  controller.listStores,
);
