import { Router } from "express";
import { authCustomer } from "../../middleware/authCustomer.js";
import { requireOnboarded } from "../../middleware/requireOnboarded.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./upload.controller.js";
import * as schemas from "./upload.validation.js";

// Mounted at /uploads.
export const uploadRoutes = Router();

uploadRoutes.post(
  "/prescriptions",
  authCustomer,
  requireOnboarded,
  validate(schemas.createPrescriptionUploadSchema),
  controller.createPrescriptionUploadUrl,
);
