import { describe, expect, it } from "vitest";
import { parseEnv } from "../src/config/env.js";

const valid = {
  NODE_ENV: "production",
  PORT: "4000",
  MONGODB_URI: "mongodb+srv://user:s3cret@cluster.example.net/medstore",
  LOG_LEVEL: "info",
  TRUST_PROXY: "1",
  JWT_CUSTOMER_ACCESS_SECRET: "customer-access-secret-0123456789abcdef",
  OTP_HMAC_SECRET: "otp-hmac-secret-0123456789abcdef01234",
  GOOGLE_WEB_CLIENT_ID: "1234-abc.apps.googleusercontent.com",
  EMAIL_API_KEY: "re_example_key",
  EMAIL_FROM: "MedStore <no-reply@example.com>",
};

const errorMessage = (source) => {
  try {
    parseEnv(source);
  } catch (error) {
    return error.message;
  }
  throw new Error("expected parseEnv to throw");
};

describe("parseEnv", () => {
  it("parses a valid environment and converts numbers", () => {
    expect(parseEnv(valid)).toEqual({ ...valid, PORT: 4000, TRUST_PROXY: 1 });
  });

  it.each(Object.keys(valid))("names %s when it is missing", (key) => {
    const rest = { ...valid };
    delete rest[key];
    expect(errorMessage(rest)).toContain(key);
  });

  it("lists every missing variable at once", () => {
    const message = errorMessage({});
    for (const key of Object.keys(valid)) {
      expect(message).toContain(key);
    }
  });

  it.each([
    ["NODE_ENV", "staging"],
    ["PORT", "abc"],
    ["PORT", ""],
    ["PORT", "70000"],
    ["MONGODB_URI", "http://secret-host.example.com"],
    ["LOG_LEVEL", "verbose"],
    ["TRUST_PROXY", "-1"],
    ["JWT_CUSTOMER_ACCESS_SECRET", "too-short-secret"],
    ["OTP_HMAC_SECRET", "too-short-secret"],
    ["GOOGLE_WEB_CLIENT_ID", "not-a-client-id"],
    ["EMAIL_FROM", "MedStore"],
    ["EMAIL_FROM", "MedStore <no-reply>"],
  ])("rejects malformed %s (%j) without echoing the value", (key, value) => {
    const message = errorMessage({ ...valid, [key]: value });
    expect(message).toContain(key);
    if (value) expect(message).not.toContain(value);
  });

  it("rejects identical access and OTP secrets", () => {
    const message = errorMessage({ ...valid, OTP_HMAC_SECRET: valid.JWT_CUSTOMER_ACCESS_SECRET });
    expect(message).toContain("OTP_HMAC_SECRET");
    expect(message).not.toContain(valid.JWT_CUSTOMER_ACCESS_SECRET);
  });

  it("accepts a bare EMAIL_FROM address", () => {
    expect(parseEnv({ ...valid, EMAIL_FROM: "no-reply@example.com" }).EMAIL_FROM).toBe(
      "no-reply@example.com",
    );
  });
});
