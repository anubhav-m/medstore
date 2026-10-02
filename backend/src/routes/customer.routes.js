import { Router } from "express";
import { addressRoutes } from "../modules/addresses/address.routes.js";
import { createAuthRoutes } from "../modules/auth/auth.routes.js";
import { createOrderRoutes } from "../modules/orders/order.routes.js";
import { storeRoutes } from "../modules/stores/store.routes.js";
import { uploadRoutes } from "../modules/uploads/upload.routes.js";
import { createUserRoutes } from "../modules/users/user.routes.js";

export const createCustomerRoutes = (rateLimits) => {
  const router = Router();
  router.use("/auth", createAuthRoutes(rateLimits));
  router.use(createUserRoutes(rateLimits));
  router.use("/addresses", addressRoutes);
  router.use("/stores", storeRoutes);
  router.use("/uploads", uploadRoutes);
  router.use("/orders", createOrderRoutes(rateLimits));
  return router;
};
