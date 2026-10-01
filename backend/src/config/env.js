import { z } from "zod";

const integerString = (min, max) =>
  z
    .string()
    .regex(/^\d+$/, "must be a whole number")
    .transform(Number)
    .pipe(z.number().int().min(min).max(max));

const secret = z.string().min(32, "must be at least 32 characters");

const EMAIL_ADDRESS = String.raw`[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+`;
const EMAIL_FROM_PATTERN = new RegExp(`^(?:${EMAIL_ADDRESS}|[^<>]+ <${EMAIL_ADDRESS}>)$`);

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]),
    PORT: integerString(0, 65535),
    MONGODB_URI: z
      .string()
      .regex(
        /^mongodb(\+srv)?:\/\/\S+$/,
        "must be a mongodb:// or mongodb+srv:// connection string",
      ),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]),
    TRUST_PROXY: integerString(0, Number.MAX_SAFE_INTEGER),
    JWT_CUSTOMER_ACCESS_SECRET: secret,
    OTP_HMAC_SECRET: secret,
    GOOGLE_WEB_CLIENT_ID: z
      .string()
      .regex(/^\S+\.apps\.googleusercontent\.com$/, "must be a Google OAuth web client id"),
    EMAIL_API_KEY: z.string().min(1),
    EMAIL_FROM: z
      .string()
      .regex(EMAIL_FROM_PATTERN, 'must be "address@domain" or "Name <address@domain>"'),
  })
  .refine((env) => env.JWT_CUSTOMER_ACCESS_SECRET !== env.OTP_HMAC_SECRET, {
    path: ["OTP_HMAC_SECRET"],
    message: "must differ from JWT_CUSTOMER_ACCESS_SECRET",
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
