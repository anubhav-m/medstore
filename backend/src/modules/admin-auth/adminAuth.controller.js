import { sendSuccess } from "../../utils/sendSuccess.js";
import { SubjectKind } from "../auth/refreshToken.model.js";
import * as sessionService from "../auth/session.service.js";
import * as pushTokenService from "../notifications/pushToken.service.js";
import * as adminAuthService from "./adminAuth.service.js";

export const login = async (req, res, next) => {
  try {
    const session = await adminAuthService.login(req.validated.body);
    return sendSuccess(res, { message: "Signed in", data: session });
  } catch (error) {
    return next(error);
  }
};

export const refresh = async (req, res, next) => {
  try {
    const session = await adminAuthService.refresh(req.validated.body.refreshToken);
    return sendSuccess(res, { message: "Session refreshed", data: session });
  } catch (error) {
    return next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    await sessionService.logout(SubjectKind.ADMIN, req.validated.body);
    return sendSuccess(res, { message: "Signed out" });
  } catch (error) {
    return next(error);
  }
};

export const registerPushToken = async (req, res, next) => {
  try {
    await pushTokenService.registerPushToken(
      SubjectKind.ADMIN,
      req.admin.id,
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
      SubjectKind.ADMIN,
      req.admin.id,
      req.validated.body.token,
    );
    return sendSuccess(res, { message: "Notifications turned off" });
  } catch (error) {
    return next(error);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const session = await adminAuthService.changePassword(req.admin.id, req.validated.body);
    return sendSuccess(res, { message: "Password changed", data: session });
  } catch (error) {
    return next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    const me = await adminAuthService.getMe(req.admin.id);
    return sendSuccess(res, { message: "Profile loaded", data: me });
  } catch (error) {
    return next(error);
  }
};
