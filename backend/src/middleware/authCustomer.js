import { ErrorCodes } from "@medstore/shared";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { CUSTOMER_AUDIENCE } from "../modules/auth/session.service.js";
import { User } from "../modules/users/user.model.js";
import { AppError } from "../utils/AppError.js";

const invalidToken = () => new AppError("Invalid session", 401, ErrorCodes.INVALID_TOKEN);

// jwt.verify throws TokenExpiredError / JsonWebTokenError, which the error handler classifies.
export const authCustomer = async (req, _res, next) => {
  try {
    const [, token] = /^Bearer (\S+)$/.exec(req.get("authorization") ?? "") ?? [];
    if (!token) throw invalidToken();

    const { sub } = jwt.verify(token, env.JWT_CUSTOMER_ACCESS_SECRET, {
      algorithms: ["HS256"],
      audience: CUSTOMER_AUDIENCE,
    });
    if (!mongoose.isObjectIdOrHexString(sub)) throw invalidToken();
    if (!(await User.exists({ _id: sub }))) throw invalidToken();

    req.user = { id: sub };
    return next();
  } catch (error) {
    return next(error);
  }
};
