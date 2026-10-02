import { parseArgs } from "node:util";
import mongoose from "mongoose";
import { ZodError } from "zod";
import { connectDb, disconnectDb } from "../src/config/db.js";
import { env } from "../src/config/env.js";
import { logger } from "../src/config/logger.js";
import { AppError } from "../src/utils/AppError.js";
import { write } from "./lib/prompt.js";
import { ScriptError } from "./lib/runAdminScript.js";
import { seedDevStores } from "./lib/seedDevStores.js";

const USAGE = "Usage: npm run seed:dev -- --lat <lat> --lng <lng>";

const readPin = () => {
  const { values } = parseArgs({
    options: { lat: { type: "string" }, lng: { type: "string" } },
  });
  const lat = Number(values.lat);
  const lng = Number(values.lng);
  if (!values.lat || !values.lng || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new ScriptError(USAGE);
  }
  return { lat, lng };
};

try {
  const pin = readPin();
  // Checked here too, so production is never even connected to.
  if (env.NODE_ENV !== "development") {
    throw new ScriptError(`Refusing to seed: NODE_ENV is "${env.NODE_ENV}", not "development".`);
  }
  await connectDb(env.MONGODB_URI);
  const { host, name } = mongoose.connection;
  write(`Target database: "${name}" on ${host}\n`);
  const results = await seedDevStores({ ...pin, nodeEnv: env.NODE_ENV });
  for (const { code, action } of results) write(`${code} ${action}\n`);
  write("Assign them to test staff with npm run admin:create or npm run admin:set-stores.\n");
} catch (error) {
  process.exitCode = 1;
  if (error instanceof ZodError) write(`${error.issues[0].message}\n`);
  else if (error instanceof ScriptError || error instanceof AppError) write(`${error.message}\n`);
  else if (error?.code === "ERR_PARSE_ARGS_UNKNOWN_OPTION") write(`${USAGE}\n`);
  else logger.error({ err: error }, "dev seed failed");
} finally {
  await disconnectDb();
}
