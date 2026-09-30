import { ErrorCodes } from "@medstore/shared";
import rateLimit from "express-rate-limit";
import { AppError } from "../utils/AppError.js";

export const createRateLimit = ({ windowMs, limit }) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(
        new AppError(
          "Too many requests. Please try again later.",
          429,
          ErrorCodes.TOO_MANY_REQUESTS,
        ),
      ),
  });
