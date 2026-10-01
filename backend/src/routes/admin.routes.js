import { Router } from "express";
import { createAdminAuthRoutes } from "../modules/admin-auth/adminAuth.routes.js";
import { orderAdminRoutes } from "../modules/orders/order.admin.routes.js";
import { storeAdminRoutes } from "../modules/stores/store.admin.routes.js";

export const createAdminRoutes = (rateLimits) => {
  const router = Router();
  router.use(createAdminAuthRoutes(rateLimits));
  router.use("/stores", storeAdminRoutes);
  router.use(orderAdminRoutes);
  return router;
};
