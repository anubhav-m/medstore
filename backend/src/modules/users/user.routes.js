import { Router } from "express";
import { authCustomer } from "../../middleware/authCustomer.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./user.controller.js";
import * as schemas from "./user.validation.js";

// Profile and onboarding stay reachable before onboarding (no requireOnboarded).
export const userRoutes = Router();

userRoutes.get("/me", authCustomer, controller.getMe);
userRoutes.patch("/me", authCustomer, validate(schemas.updateMeSchema), controller.updateMe);
userRoutes.post(
  "/me/onboarding",
  authCustomer,
  validate(schemas.onboardingSchema),
  controller.completeOnboarding,
);
