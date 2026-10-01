import mongoose from "mongoose";
import { connectDb, disconnectDb } from "../../src/config/db.js";
import { env } from "../../src/config/env.js";
import { logger } from "../../src/config/logger.js";
import { AppError } from "../../src/utils/AppError.js";
import { PromptAbortedError, ask, write } from "./prompt.js";

// For failures the operator can fix (unknown username, taken username…).
export class ScriptError extends Error {
  constructor(message) {
    super(message);
    this.name = "ScriptError";
  }
}

const isExpected = (error) =>
  error instanceof ScriptError || error instanceof AppError || error instanceof PromptAbortedError;

// Shows which database will be written to (scripts also run against production) and asks for
// "yes" before main runs. The hidden prompt needs raw mode, which only a TTY has.
export const runAdminScript = async (main) => {
  try {
    if (!process.stdin.isTTY) {
      throw new ScriptError(
        "This script needs an interactive terminal. Run it from PowerShell, Windows Terminal or the VS Code terminal (not Git Bash).",
      );
    }
    await connectDb(env.MONGODB_URI);
    const { host, name } = mongoose.connection;
    write(`Target database: "${name}" on ${host}\n`);
    if ((await ask('Type "yes" to continue: ')).trim() !== "yes") {
      throw new ScriptError("Nothing was changed.");
    }
    await main();
  } catch (error) {
    process.exitCode = 1;
    if (isExpected(error)) write(`${error.message}\n`);
    else logger.error({ err: error }, "admin script failed");
  } finally {
    await disconnectDb();
  }
};
