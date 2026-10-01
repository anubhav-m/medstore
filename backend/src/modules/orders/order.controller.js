import { sendSuccess } from "../../utils/sendSuccess.js";
import * as placementService from "./orderPlacement.service.js";
import * as orderService from "./order.service.js";

export const createOrder = async (req, res, next) => {
  try {
    const order = await placementService.createOrder(
      req.user.id,
      req.validated.headers["idempotency-key"],
      req.validated.body,
    );
    return sendSuccess(res, { message: "Order placed", data: { order } });
  } catch (error) {
    return next(error);
  }
};

export const reorder = async (req, res, next) => {
  try {
    const order = await placementService.reorder(
      req.user.id,
      req.validated.params.id,
      req.validated.headers["idempotency-key"],
      req.validated.body,
    );
    return sendSuccess(res, { message: "Order placed", data: { order } });
  } catch (error) {
    return next(error);
  }
};

export const listOrders = async (req, res, next) => {
  try {
    const { orders, meta } = await orderService.listOrders(req.user.id, req.validated.query);
    return sendSuccess(res, { message: "Orders loaded", data: { orders }, meta });
  } catch (error) {
    return next(error);
  }
};

export const getOrder = async (req, res, next) => {
  try {
    const order = await orderService.getOrder(req.user.id, req.validated.params.id);
    return sendSuccess(res, { message: "Order loaded", data: { order } });
  } catch (error) {
    return next(error);
  }
};

export const confirmOrder = async (req, res, next) => {
  try {
    const order = await orderService.confirmOrder(
      req.user.id,
      req.validated.params.id,
      req.validated.body.billVersion,
    );
    return sendSuccess(res, { message: "Order confirmed", data: { order } });
  } catch (error) {
    return next(error);
  }
};

export const cancelOrder = async (req, res, next) => {
  try {
    const order = await orderService.cancelOrder(
      req.user.id,
      req.validated.params.id,
      req.validated.body,
    );
    return sendSuccess(res, { message: "Order cancelled", data: { order } });
  } catch (error) {
    return next(error);
  }
};
