import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@medstore/shared";
import { env } from "../src/config/env.js";
import { logger } from "../src/config/logger.js";
import { ensureBucket } from "../src/services/storage.js";
import { AppError } from "../src/utils/AppError.js";
import { write } from "./lib/prompt.js";

// No "yes" prompt: it only ever applies the same private settings, so running it is always safe.
write(`Supabase project: ${new URL(env.SUPABASE_URL).host}\nBucket: "${env.SUPABASE_BUCKET}"\n`);
try {
  const { created, mismatched } = await ensureBucket();
  if (mismatched.length > 0) {
    process.exitCode = 1;
    write(`The bucket was saved but these settings didn't apply: ${mismatched.join(", ")}.\n`);
  } else {
    const maxMb = MAX_IMAGE_BYTES / (1024 * 1024);
    write(
      `Bucket ${created ? "created" : "updated"}: private, files up to ${maxMb} MB, ${ALLOWED_IMAGE_TYPES.join(" and ")} only.\n`,
    );
  }
} catch (error) {
  process.exitCode = 1;
  // ensureBucket has already logged the provider's status and message.
  if (error instanceof AppError) write("Supabase refused the request; see the log line above.\n");
  else logger.error({ err: error }, "storage setup failed");
}
