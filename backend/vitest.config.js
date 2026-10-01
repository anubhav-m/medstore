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
      EMAIL_API_KEY: "test-email-api-key",
      EMAIL_FROM: "MedStore <no-reply@example.com>",
    },
    globalSetup: ["./test/globalSetup.js"],
    setupFiles: ["./test/setup.js"],
    // Mocked services (email, Google) start every test with no calls and no queued results.
    mockReset: true,
    // The first run downloads a mongod binary, which is slow on Windows.
    hookTimeout: 120_000,
  },
});
