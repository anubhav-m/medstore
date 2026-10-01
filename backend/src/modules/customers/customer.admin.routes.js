import { AdminRole } from "@medstore/shared";
import { Router } from "express";
import { authAdmin } from "../../middleware/authAdmin.js";
import { requireRole } from "../../middleware/requireRole.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./customer.admin.controller.js";
import * as schemas from "./customer.admin.validation.js";

// Mounted at /admin/customers. Owner only; the role check runs before validation, so staff get
// FORBIDDEN whatever they send.
export const customerAdminRoutes = Router();

customerAdminRoutes.patch(
  "/:id/block",
  authAdmin,
  requireRole(AdminRole.OWNER),
  validate(schemas.blockCustomerSchema),
  controller.setBlocked,
);
