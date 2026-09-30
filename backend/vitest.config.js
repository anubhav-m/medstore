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
    },
    globalSetup: ["./test/globalSetup.js"],
    setupFiles: ["./test/setup.js"],
    // The first run downloads a mongod binary, which is slow on Windows.
    hookTimeout: 120_000,
  },
});
