import { Router } from "express";
import { createAuthRoutes } from "../modules/auth/auth.routes.js";
import { userRoutes } from "../modules/users/user.routes.js";

export const createCustomerRoutes = (rateLimits) => {
  const router = Router();
  router.use("/auth", createAuthRoutes(rateLimits));
  router.use(userRoutes);
  return router;
};
