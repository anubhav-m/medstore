import { AdminRole } from "@medstore/shared";
import { Router } from "express";
import { authAdmin } from "../../middleware/authAdmin.js";
import { requireRole } from "../../middleware/requireRole.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./store.admin.controller.js";
import * as schemas from "./store.validation.js";

// Mounted at /admin/stores. The role check runs before validation, so staff get FORBIDDEN
// whatever they send.
export const storeAdminRoutes = Router();

const owner = [authAdmin, requireRole(AdminRole.OWNER)];

storeAdminRoutes.get("/", authAdmin, controller.listStores);
storeAdminRoutes.post("/", owner, validate(schemas.createStoreSchema), controller.createStore);
storeAdminRoutes.patch("/:id", owner, validate(schemas.updateStoreSchema), controller.updateStore);
