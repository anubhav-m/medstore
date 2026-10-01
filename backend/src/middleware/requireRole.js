import { ErrorCodes } from "@medstore/shared";
import { AppError } from "../utils/AppError.js";

// Runs after authAdmin, which loads the role from the database.
export const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (roles.includes(req.admin.role)) return next();
    return next(new AppError("You don't have permission to do this", 403, ErrorCodes.FORBIDDEN));
  };
