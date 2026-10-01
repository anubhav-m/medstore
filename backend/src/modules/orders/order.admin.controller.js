import { sendSuccess } from "../../utils/sendSuccess.js";
import * as actions from "./orderAdminActions.service.js";
import * as adminOrderService from "./order.admin.service.js";

export const listOrders = async (req, res, next) => {
  try {
    const { orders, meta } = await adminOrderService.listOrders(req.admin, req.validated.query);
    return sendSuccess(res, { message: "Orders loaded", data: { orders }, meta });
  } catch (error) {
    return next(error);
  }
};

export const countOrders = async (req, res, next) => {
  try {
    const counts = await adminOrderService.countOrders(req.admin, req.validated.query);
    return sendSuccess(res, { message: "Order counts loaded", data: { counts } });
  } catch (error) {
    return next(error);
  }
};

export const getOrder = async (req, res, next) => {
  try {
    const order = await adminOrderService.getOrder(req.admin, req.validated.params.id);
    return sendSuccess(res, { message: "Order loaded", data: { order } });
  } catch (error) {
    return next(error);
  }
};

export const suggestItemNames = async (req, res, next) => {
  try {
    const suggestions = await adminOrderService.suggestItemNames(req.admin, req.validated.query);
    return sendSuccess(res, { message: "Suggestions loaded", data: { suggestions } });
  } catch (error) {
    return next(error);
  }
};

export const rejectOrder = async (req, res, next) => {
  try {
    const order = await actions.rejectOrder(req.admin, req.validated.params.id, req.validated.body);
    return sendSuccess(res, { message: "Order rejected", data: { order } });
  } catch (error) {
    return next(error);
  }
};

export const sendBill = async (req, res, next) => {
  try {
    const order = await actions.sendBill(req.admin, req.validated.params.id, req.validated.body);
    return sendSuccess(res, { message: "Bill sent", data: { order } });
  } catch (error) {
    return next(error);
  }
};

export const packOrder = async (req, res, next) => {
  try {
    const order = await actions.packOrder(req.admin, req.validated.params.id);
    return sendSuccess(res, { message: "Order packed", data: { order } });
  } catch (error) {
    return next(error);
  }
};

export const dispatchOrder = async (req, res, next) => {
  try {
    const order = await actions.dispatchOrder(req.admin, req.validated.params.id);
    return sendSuccess(res, { message: "Order out for delivery", data: { order } });
  } catch (error) {
    return next(error);
  }
};

export const deliverOrder = async (req, res, next) => {
  try {
    const order = await actions.deliverOrder(
      req.admin,
      req.validated.params.id,
      req.validated.body,
    );
    return sendSuccess(res, { message: "Order delivered", data: { order } });
  } catch (error) {
    return next(error);
  }
};

export const failDelivery = async (req, res, next) => {
  try {
    const order = await actions.failDelivery(
      req.admin,
      req.validated.params.id,
      req.validated.body,
    );
    return sendSuccess(res, { message: "Delivery marked as failed", data: { order } });
  } catch (error) {
    return next(error);
  }
};

export const cancelOrder = async (req, res, next) => {
  try {
    const order = await actions.cancelOrder(req.admin, req.validated.params.id, req.validated.body);
    return sendSuccess(res, { message: "Order cancelled", data: { order } });
  } catch (error) {
    return next(error);
  }
};
