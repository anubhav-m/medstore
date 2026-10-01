import { Router } from "express";
import { createAdminAuthRoutes } from "../modules/admin-auth/adminAuth.routes.js";

export const createAdminRoutes = (rateLimits) => {
  const router = Router();
  router.use(createAdminAuthRoutes(rateLimits));
  return router;
};
