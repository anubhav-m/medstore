import { ErrorCodes } from "@medstore/shared";
import mongoose from "mongoose";
import { ZodError } from "zod";
import { logger } from "../config/logger.js";
import { AppError } from "../utils/AppError.js";

const GENERIC_MESSAGE = "Something went wrong. Please try again.";

// Matched by name so the classifier doesn't depend on the jsonwebtoken or mongodb packages.
const INVALID_TOKEN_ERRORS = new Set(["JsonWebTokenError", "NotBeforeError"]);
const DB_UNAVAILABLE_ERRORS = new Set([
  "MongooseServerSelectionError",
  "MongoServerSelectionError",
  "MongoNetworkError",
  "MongoNetworkTimeoutError",
  "MongoNotConnectedError",
]);

// Cast failures would echo the rejected value, so they get a generic message.
const mongooseFieldErrors = (error) =>
  Object.entries(error.errors).map(([field, fieldError]) => ({
    field,
    message: fieldError instanceof mongoose.Error.CastError ? "Invalid value" : fieldError.message,
  }));

// Strict schemas report all unknown keys in one issue at the object's path; each key gets its own
// entry so clients can point at the field.
const zodFieldErrors = (error) =>
  error.issues.flatMap((issue) =>
    issue.code === "unrecognized_keys"
      ? issue.keys.map((key) => ({
          field: [...issue.path, key].join("."),
          message: "This field is not allowed",
        }))
      : [{ field: issue.path.join("."), message: issue.message }],
  );

// Names the field, never the value.
const duplicateKeyError = (error) => {
  const [field] = Object.keys(error.keyPattern ?? {});
  if (!field) return new AppError("This record already exists", 409, ErrorCodes.DUPLICATE_RESOURCE);
  return new AppError(
    `A record with this ${field} already exists`,
    409,
    ErrorCodes.DUPLICATE_RESOURCE,
    [{ field, message: "Already exists" }],
  );
};

const classify = (error) => {
  if (error instanceof AppError) return error;
  if (error instanceof ZodError) {
    return new AppError(
      "Some fields are invalid",
      400,
      ErrorCodes.VALIDATION_ERROR,
      zodFieldErrors(error),
    );
  }
  if (error instanceof mongoose.Error.ValidationError) {
    return new AppError(
      "Some fields are invalid",
      400,
      ErrorCodes.VALIDATION_ERROR,
      mongooseFieldErrors(error),
    );
  }
  if (error instanceof mongoose.Error.CastError) {
    return new AppError("Invalid id", 400, ErrorCodes.INVALID_ID);
  }
  if (error?.code === 11000) return duplicateKeyError(error);
  if (error?.type === "entity.parse.failed") {
    return new AppError("The request body is not valid JSON", 400, ErrorCodes.INVALID_JSON);
  }
  if (error?.type === "entity.too.large") {
    return new AppError("The request body is too large", 413, ErrorCodes.PAYLOAD_TOO_LARGE);
  }
  // Any other body the parser refused (unsupported charset or encoding, aborted, wrong length).
  if (typeof error?.type === "string" && error.status >= 400 && error.status < 500) {
    return new AppError("The request body couldn't be read", 400, ErrorCodes.INVALID_JSON);
  }
  // The router failed to percent-decode a path param; path params are always ids.
  if (error instanceof URIError && error.status === 400) {
    return new AppError("Invalid id", 400, ErrorCodes.INVALID_ID);
  }
  if (error?.name === "TokenExpiredError") {
    return new AppError("Your session has expired", 401, ErrorCodes.TOKEN_EXPIRED);
  }
  if (INVALID_TOKEN_ERRORS.has(error?.name)) {
    return new AppError("Invalid session", 401, ErrorCodes.INVALID_TOKEN);
  }
  if (DB_UNAVAILABLE_ERRORS.has(error?.name)) {
    return new AppError(
      "Service temporarily unavailable. Please try again.",
      503,
      ErrorCodes.SERVICE_UNAVAILABLE,
    );
  }
  return new AppError(GENERIC_MESSAGE, 500, ErrorCodes.INTERNAL_SERVER_ERROR);
};

export const errorHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);

  const { statusCode, code, message, errors } = classify(error);
  const log = req.log ?? logger;
  if (statusCode >= 500) {
    log.error({ err: error, code }, "request failed");
  } else {
    // 4xx messages can echo input (e.g. duplicate-key values), so only the code and name are logged.
    log.warn({ code, errorName: error?.name }, "request rejected");
  }

  return res.status(statusCode).json({
    success: false,
    message,
    code,
    ...(errors !== undefined && { errors }),
  });
};
