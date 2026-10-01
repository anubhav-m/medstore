import { Router } from "express";
import { authAdmin } from "../../middleware/authAdmin.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./order.admin.controller.js";
import * as schemas from "./order.admin.validation.js";
import { orderIdSchema } from "./order.validation.js";

// Mounted at /admin. Staff and owners alike; the services limit every query to the admin's
// stores.
export const orderAdminRoutes = Router();

const route = (method, path, schema, handler) =>
  orderAdminRoutes[method](path, authAdmin, validate(schema), handler);

route("get", "/orders", schemas.listOrdersSchema, controller.listOrders);
// Before /orders/:id, which would read "counts" as an id.
route("get", "/orders/counts", schemas.orderCountsSchema, controller.countOrders);
route("get", "/orders/:id", orderIdSchema, controller.getOrder);
route("post", "/orders/:id/reject", schemas.rejectSchema, controller.rejectOrder);
route("post", "/orders/:id/bill", schemas.sendBillSchema, controller.sendBill);
route("post", "/orders/:id/pack", schemas.noInputActionSchema, controller.packOrder);
route("post", "/orders/:id/dispatch", schemas.noInputActionSchema, controller.dispatchOrder);
route("post", "/orders/:id/deliver", schemas.deliverSchema, controller.deliverOrder);
route("post", "/orders/:id/fail", schemas.failDeliverySchema, controller.failDelivery);
route("post", "/orders/:id/cancel", schemas.staffCancelSchema, controller.cancelOrder);
route("get", "/item-suggestions", schemas.itemSuggestionsSchema, controller.suggestItemNames);
