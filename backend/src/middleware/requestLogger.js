import { pinoHttp } from "pino-http";
import { logger } from "../config/logger.js";

// The route pattern, never the raw URL: query strings can carry phone numbers.
const routeOf = (req) => (req.route ? `${req.baseUrl}${req.route.path}` : "unmatched");

const summarize = (req, res, { responseTime }) => ({
  method: req.method,
  route: routeOf(req),
  statusCode: res.statusCode,
  responseTime,
});

const levelFor = (_req, res, error) => {
  if (error || res.statusCode >= 500) return "error";
  if (res.statusCode >= 400) return "warn";
  return "info";
};

export const requestLogger = pinoHttp({
  logger,
  quietReqLogger: true,
  quietResLogger: true,
  customLogLevel: levelFor,
  customSuccessObject: (req, res, value) => summarize(req, res, value),
  customErrorObject: (req, res, _error, value) => summarize(req, res, value),
  customSuccessMessage: () => "request completed",
  customErrorMessage: () => "request failed",
});
