import { OtpPurpose } from "@medstore/shared";
import { sendSuccess } from "../../utils/sendSuccess.js";
import * as loginService from "./login.service.js";
import * as otpService from "./otp.service.js";
import * as passwordResetService from "./passwordReset.service.js";
import { SubjectKind } from "./refreshToken.model.js";
import * as sessionService from "./session.service.js";
import * as signupService from "./signup.service.js";

// Identical for known and unknown emails.
const CODE_REQUESTED_MESSAGE = "If an account exists for this email, we've sent a code to it";

export const register = async (req, res, next) => {
  try {
    await signupService.register(req.validated.body);
    return sendSuccess(res, { message: "We sent a verification code to your email" });
  } catch (error) {
    return next(error);
  }
};

export const verifyEmail = async (req, res, next) => {
  try {
    const session = await signupService.verifyEmail(req.validated.body);
    return sendSuccess(res, { message: "Email verified", data: session });
  } catch (error) {
    return next(error);
  }
};

export const resendCode = async (req, res, next) => {
  try {
    const { email, purpose } = req.validated.body;
    await otpService.requestCode(email, purpose);
    return sendSuccess(res, { message: CODE_REQUESTED_MESSAGE });
  } catch (error) {
    return next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const session = await loginService.login(req.validated.body);
    return sendSuccess(res, { message: "Signed in", data: session });
  } catch (error) {
    return next(error);
  }
};

export const google = async (req, res, next) => {
  try {
    const session = await loginService.loginWithGoogle(req.validated.body);
    return sendSuccess(res, { message: "Signed in", data: session });
  } catch (error) {
    return next(error);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    await otpService.requestCode(req.validated.body.email, OtpPurpose.RESET_PASSWORD);
    return sendSuccess(res, { message: CODE_REQUESTED_MESSAGE });
  } catch (error) {
    return next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    await passwordResetService.resetPassword(req.validated.body);
    return sendSuccess(res, { message: "Password updated. Please sign in." });
  } catch (error) {
    return next(error);
  }
};

export const refresh = async (req, res, next) => {
  try {
    const session = await sessionService.refreshCustomerSession(req.validated.body.refreshToken);
    return sendSuccess(res, { message: "Session refreshed", data: session });
  } catch (error) {
    return next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    await sessionService.revokeRefreshToken(req.validated.body.refreshToken, SubjectKind.CUSTOMER);
    return sendSuccess(res, { message: "Signed out" });
  } catch (error) {
    return next(error);
  }
};
