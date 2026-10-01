import { AdminRole } from "@medstore/shared";
import { Router } from "express";
import { authAdmin } from "../../middleware/authAdmin.js";
import { requireRole } from "../../middleware/requireRole.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./report.controller.js";
import * as schemas from "./report.validation.js";

// Mounted at /admin/reports. Owner only; the role check runs before validation, so staff get
// FORBIDDEN whatever they send.
export const reportRoutes = Router();

reportRoutes.get(
  "/daily",
  authAdmin,
  requireRole(AdminRole.OWNER),
  validate(schemas.dailyReportSchema),
  controller.getDailyReport,
);
