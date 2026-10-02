import { once } from "node:events";
import { createApp } from "./app.js";
import { connectDb, disconnectDb } from "./config/db.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { startUnusedUploadsJob } from "./jobs/deleteUnusedUploads.js";
import { startUnverifiedAccountsJob } from "./jobs/deleteUnverifiedAccounts.js";
import { startBillExpiryJob } from "./jobs/expireUnconfirmedBills.js";

const SHUTDOWN_TIMEOUT_MS = 10_000;

process.on("unhandledRejection", (reason) => {
  logger.fatal({ err: reason }, "unhandled promise rejection");
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "uncaught exception");
  process.exit(1);
});

await connectDb(env.MONGODB_URI);

const server = createApp().listen(env.PORT);
await once(server, "listening");
logger.info({ port: env.PORT }, "server listening");

const stopJobs = [startBillExpiryJob(), startUnusedUploadsJob(), startUnverifiedAccountsJob()];

let shuttingDown = false;

const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "shutting down");

  const forceExit = setTimeout(() => {
    logger.fatal("shutdown timed out");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  for (const stop of stopJobs) stop();
  server.close();
  server.closeIdleConnections();
  await once(server, "close");
  await disconnectDb();
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
