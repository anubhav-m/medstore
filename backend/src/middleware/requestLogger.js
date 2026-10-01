import { pinoHttp } from "pino-http";
import { logger } from "../config/logger.js";

// Express resets req.baseUrl as a request leaves each router, so when a failed request is logged
// (after the central error handler) only the innermost path would remain. The router assigns
// req.route at the moment it matches, while req.baseUrl still holds the full mount path, so the
// whole pattern is recorded then.
export const recordRoutePattern = (req, _res, next) => {
  let route;
  Object.defineProperty(req, "route", {
    configurable: true,
    enumerable: true,
    get: () => route,
    set: (value) => {
      route = value;
      req.routePattern = `${req.baseUrl}${value.path}`;
    },
  });
  return next();
};

// The route pattern, never the raw URL: query strings can carry phone numbers.
const summarize = (req, res, { responseTime }) => ({
  method: req.method,
  route: req.routePattern ?? "unmatched",
  statusCode: res.statusCode,
  responseTime,
});

const levelFor = (_req, res, error) => {
  if (error || res.statusCode >= 500) return "error";
  if (res.statusCode >= 400) return "warn";
  return "info";
};

const httpLogger = pinoHttp({
  logger,
  quietReqLogger: true,
  quietResLogger: true,
  customLogLevel: levelFor,
  customSuccessObject: (req, res, value) => summarize(req, res, value),
  customErrorObject: (req, res, _error, value) => summarize(req, res, value),
  customSuccessMessage: () => "request completed",
  customErrorMessage: () => "request failed",
});

export const requestLogger = [httpLogger, recordRoutePattern];
