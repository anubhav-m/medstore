import { sendSuccess } from "../../utils/sendSuccess.js";
import * as userService from "./user.service.js";

export const getMe = async (req, res, next) => {
  try {
    const user = await userService.getMe(req.user.id);
    return sendSuccess(res, { message: "Profile loaded", data: { user } });
  } catch (error) {
    return next(error);
  }
};

export const updateMe = async (req, res, next) => {
  try {
    const user = await userService.updateMe(req.user.id, req.validated.body);
    return sendSuccess(res, { message: "Profile updated", data: { user } });
  } catch (error) {
    return next(error);
  }
};

export const completeOnboarding = async (req, res, next) => {
  try {
    const result = await userService.completeOnboarding(req.user.id, req.validated.body);
    return sendSuccess(res, { message: "Welcome aboard", data: result });
  } catch (error) {
    return next(error);
  }
};
