import { ErrorCodes } from "@medstore/shared";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { AppError } from "../utils/AppError.js";

export const createRateLimit = (
  { windowMs, limit },
  { keyGenerator, skipSuccessfulRequests = false } = {},
) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests,
    ...(keyGenerator && { keyGenerator }),
    handler: (_req, _res, next) =>
      next(
        new AppError(
          "Too many requests. Please try again later.",
          429,
          ErrorCodes.TOO_MANY_REQUESTS,
        ),
      ),
  });

// Runs before validation, so the body may be anything; a non-string email counts as "".
export const ipAndEmailKey = (req) => {
  const email = req.body?.email;
  const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";
  return `${ipKeyGenerator(req.ip)}|${normalized}`;
};

// Per username across all IPs (root 3.8), normalized the way login does; runs before validation.
export const adminUsernameKey = (req) => {
  const username = req.body?.username;
  return typeof username === "string" ? username.trim().toLowerCase() : "";
};

// Per customer, for routes behind authCustomer.
export const customerKey = (req) => req.user.id;
