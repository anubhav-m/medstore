import { Router } from "express";
import { authCustomer } from "../../middleware/authCustomer.js";
import { requireOnboarded } from "../../middleware/requireOnboarded.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./address.controller.js";
import * as schemas from "./address.validation.js";

// Mounted at /addresses. Auth is attached per route (not router.use) so a rejected request still
// has a matched route for the request log.
export const addressRoutes = Router();

const customer = [authCustomer, requireOnboarded];

addressRoutes.get("/", customer, controller.listAddresses);
addressRoutes.post("/", customer, validate(schemas.createAddressSchema), controller.createAddress);
addressRoutes.patch(
  "/:id",
  customer,
  validate(schemas.updateAddressSchema),
  controller.updateAddress,
);
addressRoutes.delete(
  "/:id",
  customer,
  validate(schemas.deleteAddressSchema),
  controller.deleteAddress,
);
