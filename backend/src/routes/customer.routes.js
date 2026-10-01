import { Router } from "express";
import { addressRoutes } from "../modules/addresses/address.routes.js";
import { createAuthRoutes } from "../modules/auth/auth.routes.js";
import { storeRoutes } from "../modules/stores/store.routes.js";
import { userRoutes } from "../modules/users/user.routes.js";

export const createCustomerRoutes = (rateLimits) => {
  const router = Router();
  router.use("/auth", createAuthRoutes(rateLimits));
  router.use(userRoutes);
  router.use("/addresses", addressRoutes);
  router.use("/stores", storeRoutes);
  return router;
};
