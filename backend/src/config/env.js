import { z } from "zod";

const integerString = (min, max) =>
  z
    .string()
    .regex(/^\d+$/, "must be a whole number")
    .transform(Number)
    .pipe(z.number().int().min(min).max(max));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  PORT: integerString(0, 65535),
  MONGODB_URI: z
    .string()
    .regex(/^mongodb(\+srv)?:\/\/\S+$/, "must be a mongodb:// or mongodb+srv:// connection string"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]),
  TRUST_PROXY: integerString(0, Number.MAX_SAFE_INTEGER),
});

// Messages name the variable only — values may be secrets.
export const parseEnv = (source) => {
  const result = envSchema.safeParse(source);
  if (result.success) return result.data;
  const problems = result.error.issues.map(
    (issue) => `- ${issue.path.join(".")}: ${issue.message}`,
  );
  throw new Error(`Invalid environment variables:\n${problems.join("\n")}`);
};

export const env = parseEnv(process.env);
