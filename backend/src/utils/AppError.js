import { ErrorCodes } from "@medstore/shared";

export class AppError extends Error {
  constructor(message, statusCode, code, errors) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
  }
}

// Also for a valid token whose account no longer exists (e.g. deleted mid-request).
export const invalidToken = () => new AppError("Invalid session", 401, ErrorCodes.INVALID_TOKEN);
