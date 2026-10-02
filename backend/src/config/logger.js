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
  // Signed photo view URLs carry their token too.
  "imageUrls",
  "email",
  "phone",
  "customerPhone",
  "customerName",
  "dob",
  "address",
  "deliveryAddress",
  "line1",
  "line2",
  "landmark",
  "location",
  "lat",
  "lng",
  "patientName",
  "note",
  "customerNote",
  "reason",
  "blockReason",
  "items",
  "imagePaths",
  "images",
  // Admin order search: an order number or a phone number.
  "q",
];

// `code` and `name` are redacted only inside request bodies (OTP codes, customer names):
// elsewhere they hold error codes such as VALIDATION_ERROR and error names, which logs must keep.
const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "req.body.code",
  "body.code",
  "req.body.name",
  "body.name",
  ...SENSITIVE_KEYS.flatMap((key) => [key, `*.${key}`, `*.*.${key}`]),
];

export const createLogger = ({ level, destination }) => {
  const options = { level, redact: { paths: REDACT_PATHS, censor: "[REDACTED]" } };
  return destination ? pino(options, destination) : pino(options);
};

export const logger = createLogger({ level: env.LOG_LEVEL });
