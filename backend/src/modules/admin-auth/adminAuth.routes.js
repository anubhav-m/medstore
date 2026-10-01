import { Router } from "express";
import { authAdminAllowPasswordChange } from "../../middleware/authAdmin.js";
import { adminUsernameKey, createRateLimit } from "../../middleware/rateLimit.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./adminAuth.controller.js";
import * as schemas from "./adminAuth.validation.js";

// Built per app so every app instance (and every test) gets its own limiter state.
// Only failed attempts count, so staff sharing a shop's IP aren't blocked by each other's logins.
export const createAdminAuthRoutes = (rateLimits) => {
  const router = Router();
  const failedPerIp = createRateLimit(rateLimits.adminLoginIp, { skipSuccessfulRequests: true });
  const failedPerUsername = createRateLimit(rateLimits.adminLogin, {
    keyGenerator: adminUsernameKey,
    skipSuccessfulRequests: true,
  });
  const refresh = createRateLimit(rateLimits.refresh);

  router.post(
    "/auth/login",
    failedPerIp,
    failedPerUsername,
    validate(schemas.loginSchema),
    controller.login,
  );
  router.post("/auth/refresh", refresh, validate(schemas.refreshSchema), controller.refresh);
  router.post("/auth/logout", validate(schemas.logoutSchema), controller.logout);
  router.post(
    "/auth/change-password",
    failedPerIp,
    authAdminAllowPasswordChange,
    validate(schemas.changePasswordSchema),
    controller.changePassword,
  );
  router.get("/me", authAdminAllowPasswordChange, controller.getMe);

  return router;
};
