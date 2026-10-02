import { logger } from "../config/logger.js";

// Wraps a job so a run that starts while the previous one is still going is skipped (returns
// null). Overlapping runs from elsewhere (e.g. two instances) must still be safe on their own.
export const skipWhileRunning = (run) => {
  let running = false;
  return async (now = new Date()) => {
    if (running) return null;
    running = true;
    try {
      return await run(now);
    } finally {
      running = false;
    }
  };
};

// Started by server.js only — never by createApp() or tests. Returns the function that stops it.
export const startJob = (job, run, intervalMs) => {
  const timer = setInterval(async () => {
    try {
      await run();
    } catch (error) {
      logger.error({ err: error, job }, "job run failed");
    }
  }, intervalMs);
  return () => clearInterval(timer);
};
