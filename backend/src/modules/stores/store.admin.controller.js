import { sendSuccess } from "../../utils/sendSuccess.js";
import * as storeService from "./store.service.js";

export const listStores = async (req, res, next) => {
  try {
    const stores = await storeService.listAdminStores(req.admin);
    return sendSuccess(res, { message: "Stores loaded", data: { stores } });
  } catch (error) {
    return next(error);
  }
};

export const createStore = async (req, res, next) => {
  try {
    const store = await storeService.createStore(req.validated.body);
    return sendSuccess(res, { message: "Store created", data: { store } });
  } catch (error) {
    return next(error);
  }
};

export const updateStore = async (req, res, next) => {
  try {
    const store = await storeService.updateStore(req.validated.params.id, req.validated.body);
    return sendSuccess(res, { message: "Store updated", data: { store } });
  } catch (error) {
    return next(error);
  }
};
