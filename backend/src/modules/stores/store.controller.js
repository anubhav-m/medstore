import { sendSuccess } from "../../utils/sendSuccess.js";
import * as storeService from "./store.service.js";

export const listStores = async (req, res, next) => {
  try {
    const stores = await storeService.listStoresForAddress(
      req.user.id,
      req.validated.query.addressId,
    );
    return sendSuccess(res, { message: "Stores loaded", data: { stores } });
  } catch (error) {
    return next(error);
  }
};
