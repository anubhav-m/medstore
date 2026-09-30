export class AppError extends Error {
  constructor(message, statusCode, code, errors) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
  }
}
