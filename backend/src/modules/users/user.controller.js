import { sendSuccess } from "../../utils/sendSuccess.js";
import { SubjectKind } from "../auth/refreshToken.model.js";
import * as pushTokenService from "../notifications/pushToken.service.js";
import * as accountDeletionService from "./accountDeletion.service.js";
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

export const deleteAccount = async (req, res, next) => {
  try {
    await accountDeletionService.deleteAccount(req.user.id, req.validated.body);
    return sendSuccess(res, { message: "Account deleted" });
  } catch (error) {
    return next(error);
  }
};

export const registerPushToken = async (req, res, next) => {
  try {
    await pushTokenService.registerPushToken(
      SubjectKind.CUSTOMER,
      req.user.id,
      req.validated.body.token,
    );
    return sendSuccess(res, { message: "Notifications turned on" });
  } catch (error) {
    return next(error);
  }
};

export const removePushToken = async (req, res, next) => {
  try {
    await pushTokenService.removePushToken(
      SubjectKind.CUSTOMER,
      req.user.id,
      req.validated.body.token,
    );
    return sendSuccess(res, { message: "Notifications turned off" });
  } catch (error) {
    return next(error);
  }
};
