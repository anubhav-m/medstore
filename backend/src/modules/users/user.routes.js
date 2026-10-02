import { Router } from "express";
import { authCustomer } from "../../middleware/authCustomer.js";
import { createRateLimit, customerKey } from "../../middleware/rateLimit.js";
import { validate } from "../../middleware/validate.js";
import { pushTokenRequestSchema } from "../notifications/pushToken.validation.js";
import * as controller from "./user.controller.js";
import * as schemas from "./user.validation.js";

// Profile, password, onboarding, account deletion and push tokens stay reachable before onboarding
// (no requireOnboarded). Built per app so every app instance (and every test) gets its own limiter.
// Password change and account deletion share one re-authentication limiter, so a stolen access
// token gets the same few password guesses in total.
export const createUserRoutes = (rateLimits) => {
  const router = Router();
  const reauth = createRateLimit(rateLimits.customerReauth, { keyGenerator: customerKey });

  router.get("/me", authCustomer, controller.getMe);
  router.patch("/me", authCustomer, validate(schemas.updateMeSchema), controller.updateMe);
  router.post(
    "/me/password",
    authCustomer,
    reauth,
    validate(schemas.changePasswordSchema),
    controller.changePassword,
  );
  // The body is sent by our own app only (backend CLAUDE.md §7).
  router.delete(
    "/me",
    authCustomer,
    reauth,
    validate(schemas.deleteAccountSchema),
    controller.deleteAccount,
  );
  router.post(
    "/me/onboarding",
    authCustomer,
    validate(schemas.onboardingSchema),
    controller.completeOnboarding,
  );
  // The token goes in the body, never the URL.
  router.post(
    "/me/push-tokens",
    authCustomer,
    validate(pushTokenRequestSchema),
    controller.registerPushToken,
  );
  router.delete(
    "/me/push-tokens",
    authCustomer,
    validate(pushTokenRequestSchema),
    controller.removePushToken,
  );
  return router;
};
