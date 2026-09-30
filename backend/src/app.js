import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { rateLimits as defaultRateLimits } from "./config/rateLimits.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";
import { createRateLimit } from "./middleware/rateLimit.js";
import { requestId } from "./middleware/requestId.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { healthRoutes } from "./modules/health/health.routes.js";

export const createApp = ({ rateLimits = defaultRateLimits } = {}) => {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", env.TRUST_PROXY);

  app.use(requestId);
  app.use(helmet());
  app.use(requestLogger);
  // Before body parsing, so malformed or oversized bodies still count toward the limit.
  app.use(createRateLimit(rateLimits.global));
  app.use(express.json({ limit: "100kb" }));

  app.use(healthRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
};
