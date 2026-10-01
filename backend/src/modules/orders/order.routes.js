import { Router } from "express";
import { authCustomer } from "../../middleware/authCustomer.js";
import { createRateLimit, customerKey } from "../../middleware/rateLimit.js";
import { requireOnboarded } from "../../middleware/requireOnboarded.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./order.controller.js";
import * as schemas from "./order.validation.js";

const customer = [authCustomer, requireOnboarded];

// Mounted at /orders. Creations and reorders share one per-customer limiter (root 3.8); it runs
// after authCustomer, which supplies the customer id.
export const createOrderRoutes = (rateLimits) => {
  const router = Router();
  const placeLimit = createRateLimit(rateLimits.orderCreate, { keyGenerator: customerKey });

  router.post(
    "/",
    customer,
    placeLimit,
    validate(schemas.createOrderSchema),
    controller.createOrder,
  );
  router.get("/", customer, validate(schemas.listOrdersSchema), controller.listOrders);
  router.get("/:id", customer, validate(schemas.orderIdSchema), controller.getOrder);
  router.post(
    "/:id/confirm",
    customer,
    validate(schemas.confirmOrderSchema),
    controller.confirmOrder,
  );
  router.post("/:id/cancel", customer, validate(schemas.cancelOrderSchema), controller.cancelOrder);
  router.post(
    "/:id/reorder",
    customer,
    placeLimit,
    validate(schemas.reorderSchema),
    controller.reorder,
  );
  return router;
};
