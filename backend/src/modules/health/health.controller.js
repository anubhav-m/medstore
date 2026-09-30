import { ErrorCodes } from "@medstore/shared";
import { isDbConnected } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { sendSuccess } from "../../utils/sendSuccess.js";

export const getHealth = (_req, res, next) => {
  try {
    if (!isDbConnected()) {
      throw new AppError(
        "Service temporarily unavailable. Please try again.",
        503,
        ErrorCodes.SERVICE_UNAVAILABLE,
      );
    }
    return sendSuccess(res, { message: "OK", data: { status: "ok", db: "connected" } });
  } catch (error) {
    return next(error);
  }
};
