import { sendSuccess } from "../../utils/sendSuccess.js";
import * as customerService from "./customer.admin.service.js";

export const setBlocked = async (req, res, next) => {
  try {
    const customer = await customerService.setBlocked(
      req.admin.id,
      req.validated.params.id,
      req.validated.body,
    );
    const message = customer.isBlocked ? "Customer blocked" : "Customer unblocked";
    return sendSuccess(res, { message, data: { customer } });
  } catch (error) {
    return next(error);
  }
};
