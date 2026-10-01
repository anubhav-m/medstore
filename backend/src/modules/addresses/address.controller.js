import { sendSuccess } from "../../utils/sendSuccess.js";
import * as addressService from "./address.service.js";

export const listAddresses = async (req, res, next) => {
  try {
    const addresses = await addressService.listAddresses(req.user.id);
    return sendSuccess(res, { message: "Addresses loaded", data: { addresses } });
  } catch (error) {
    return next(error);
  }
};

export const createAddress = async (req, res, next) => {
  try {
    const address = await addressService.createAddress(req.user.id, req.validated.body);
    return sendSuccess(res, { message: "Address saved", data: { address } });
  } catch (error) {
    return next(error);
  }
};

export const updateAddress = async (req, res, next) => {
  try {
    const address = await addressService.updateAddress(
      req.user.id,
      req.validated.params.id,
      req.validated.body,
    );
    return sendSuccess(res, { message: "Address updated", data: { address } });
  } catch (error) {
    return next(error);
  }
};

export const deleteAddress = async (req, res, next) => {
  try {
    await addressService.deleteAddress(req.user.id, req.validated.params.id);
    return sendSuccess(res, { message: "Address deleted" });
  } catch (error) {
    return next(error);
  }
};
