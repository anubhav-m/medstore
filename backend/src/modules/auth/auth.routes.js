import { Router } from "express";
import { createRateLimit, ipAndEmailKey } from "../../middleware/rateLimit.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./auth.controller.js";
import * as schemas from "./auth.validation.js";

// Built per app so every app instance (and every test) gets its own limiter state.
export const createAuthRoutes = (rateLimits) => {
  const router = Router();
  const authIp = createRateLimit(rateLimits.authIp);
  const login = createRateLimit(rateLimits.customerLogin, { keyGenerator: ipAndEmailKey });
  const codeCheck = createRateLimit(rateLimits.codeCheck);
  const refresh = createRateLimit(rateLimits.refresh);

  router.post("/register", authIp, validate(schemas.registerSchema), controller.register);
  router.post(
    "/verify-email",
    codeCheck,
    validate(schemas.verifyEmailSchema),
    controller.verifyEmail,
  );
  router.post("/resend-code", authIp, validate(schemas.resendCodeSchema), controller.resendCode);
  router.post("/login", login, validate(schemas.loginSchema), controller.login);
  router.post("/google", authIp, validate(schemas.googleSchema), controller.google);
  router.post(
    "/forgot-password",
    authIp,
    validate(schemas.forgotPasswordSchema),
    controller.forgotPassword,
  );
  router.post(
    "/reset-password",
    codeCheck,
    validate(schemas.resetPasswordSchema),
    controller.resetPassword,
  );
  router.post("/refresh", refresh, validate(schemas.refreshSchema), controller.refresh);
  router.post("/logout", validate(schemas.logoutSchema), controller.logout);

  return router;
};
