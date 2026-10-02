import { z } from "zod";

const integerString = (min, max) =>
  z
    .string()
    .regex(/^\d+$/, "must be a whole number")
    .transform(Number)
    .pipe(z.number().int().min(min).max(max));

const secret = z.string().min(32, "must be at least 32 characters");

const SECRET_KEYS = ["JWT_CUSTOMER_ACCESS_SECRET", "JWT_ADMIN_ACCESS_SECRET", "OTP_HMAC_SECRET"];

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
    JWT_ADMIN_ACCESS_SECRET: secret,
    OTP_HMAC_SECRET: secret,
    GOOGLE_WEB_CLIENT_ID: z
      .string()
      .regex(/^\S+\.apps\.googleusercontent\.com$/, "must be a Google OAuth web client id"),
    EMAIL_API_KEY: z.string().regex(/^re_\S+$/, 'must be a Resend API key ("re_…")'),
    EMAIL_FROM: z
      .string()
      .regex(EMAIL_FROM_PATTERN, 'must be "address@domain" or "Name <address@domain>"'),
    // The bare project URL; the dashboard also shows URLs with /rest/v1 etc., which break storage.
    SUPABASE_URL: z
      .url({ protocol: /^https$/, error: "must be an https:// URL" })
      .refine((url) => /^https:\/\/[^/]+\/?$/.test(url), "must be the project URL without a path"),
    // Publishable keys are bundled into apps; only a secret key may sign storage URLs.
    SUPABASE_SECRET_KEY: z
      .string()
      .regex(/^sb_secret_\S+$/, 'must be a Supabase secret key ("sb_secret_…")'),
    SUPABASE_BUCKET: z
      .string()
      .regex(/^[a-z0-9][a-z0-9_-]{1,62}$/, "must be a lowercase bucket name"),
    // Minutes a customer has to confirm a bill; capped at the store's closing time (root 3.4).
    BILL_CONFIRMATION_TIMEOUT_MINUTES: integerString(1, 1440),
    // Needed only when enhanced push security is on in the Expo project. `--env-file` turns an
    // empty line into "", which counts as absent.
    EXPO_ACCESS_TOKEN: z
      .string()
      .optional()
      .transform((value) => value || undefined),
  })
  .superRefine((env, ctx) => {
    // Production runs behind Render's proxy. With 0 hops every client would share the proxy's IP,
    // and so one rate-limit bucket.
    if (env.NODE_ENV === "production" && env.TRUST_PROXY === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["TRUST_PROXY"],
        message: "must be at least 1 in production (the app runs behind a proxy)",
      });
    }
    // A shared secret would let a token or code from one world pass as another.
    for (const [index, key] of SECRET_KEYS.entries()) {
      const earlier = SECRET_KEYS.slice(0, index).find((other) => env[other] === env[key]);
      if (earlier) {
        ctx.addIssue({ code: "custom", path: [key], message: `must differ from ${earlier}` });
      }
    }
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
