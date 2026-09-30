import { ErrorCodes } from "@medstore/shared";
import { AppError } from "../utils/AppError.js";

export const notFound = (_req, _res, next) =>
  next(new AppError("Route not found", 404, ErrorCodes.ROUTE_NOT_FOUND));
