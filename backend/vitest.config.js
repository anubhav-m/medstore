import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // env.js validates at import; the placeholder URI is never connected to (tests use the memory replica set).
    env: {
      NODE_ENV: "test",
      PORT: "0",
      MONGODB_URI: "mongodb://127.0.0.1:27017/unused",
      LOG_LEVEL: "silent",
      TRUST_PROXY: "0",
      JWT_CUSTOMER_ACCESS_SECRET: "test-customer-access-secret-0123456789abcdef",
      JWT_ADMIN_ACCESS_SECRET: "test-admin-access-secret-0123456789abcdef0",
      OTP_HMAC_SECRET: "test-otp-hmac-secret-0123456789abcdef0123",
      GOOGLE_WEB_CLIENT_ID: "test-client.apps.googleusercontent.com",
      EMAIL_API_KEY: "re_test-email-api-key",
      EMAIL_FROM: "MedStore <no-reply@example.com>",
      SUPABASE_URL: "https://test-project.supabase.co",
      SUPABASE_SECRET_KEY: "sb_secret_test-key",
      SUPABASE_BUCKET: "prescriptions",
      BILL_CONFIRMATION_TIMEOUT_MINUTES: "60",
    },
    globalSetup: ["./test/globalSetup.js"],
    setupFiles: ["./test/setup.js"],
    // Mocked services (email, Google, storage) start every test with no calls and no queued results.
    mockReset: true,
    // The first run downloads a mongod binary, which is slow on Windows.
    hookTimeout: 120_000,
    // Healthy runs take up to ~4 s per test (argon2 + transactions across parallel workers), too
    // close to the 5 s default: under load, tests failed by timeout alone.
    testTimeout: 30_000,
  },
});
