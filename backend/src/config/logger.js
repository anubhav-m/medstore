import pino from "pino";
import { env } from "./env.js";

const SENSITIVE_KEYS = [
  "password",
  "currentPassword",
  "newPassword",
  "token",
  "accessToken",
  "refreshToken",
  "idToken",
  "googleIdToken",
  "pushToken",
  // Signed upload URLs carry their token in the query string.
  "signedUrl",
  "phone",
  "customerPhone",
  "address",
  "deliveryAddress",
  "patientName",
  "note",
  "customerNote",
  "items",
];

// `code` is redacted only inside request bodies (OTP codes): elsewhere it holds error codes
// such as VALIDATION_ERROR, which logs must keep.
const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "req.body.code",
  "body.code",
  ...SENSITIVE_KEYS.flatMap((key) => [key, `*.${key}`, `*.*.${key}`]),
];

export const createLogger = ({ level, destination }) => {
  const options = { level, redact: { paths: REDACT_PATHS, censor: "[REDACTED]" } };
  return destination ? pino(options, destination) : pino(options);
};

export const logger = createLogger({ level: env.LOG_LEVEL });
