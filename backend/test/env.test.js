import { describe, expect, it } from "vitest";
import { parseEnv } from "../src/config/env.js";

const valid = {
  NODE_ENV: "production",
  PORT: "4000",
  MONGODB_URI: "mongodb+srv://user:s3cret@cluster.example.net/medstore",
  LOG_LEVEL: "info",
  TRUST_PROXY: "1",
  JWT_CUSTOMER_ACCESS_SECRET: "customer-access-secret-0123456789abcdef",
  JWT_ADMIN_ACCESS_SECRET: "admin-access-secret-0123456789abcdef012",
  OTP_HMAC_SECRET: "otp-hmac-secret-0123456789abcdef01234",
  GOOGLE_WEB_CLIENT_ID: "1234-abc.apps.googleusercontent.com",
  EMAIL_API_KEY: "re_example_key",
  EMAIL_FROM: "MedStore <no-reply@example.com>",
  SUPABASE_URL: "https://abcdefghijklmnop.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_example-key",
  SUPABASE_BUCKET: "prescriptions",
  BILL_CONFIRMATION_TIMEOUT_MINUTES: "60",
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
    expect(parseEnv(valid)).toEqual({
      ...valid,
      PORT: 4000,
      TRUST_PROXY: 1,
      BILL_CONFIRMATION_TIMEOUT_MINUTES: 60,
    });
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
    ["JWT_ADMIN_ACCESS_SECRET", "too-short-secret"],
    ["OTP_HMAC_SECRET", "too-short-secret"],
    ["GOOGLE_WEB_CLIENT_ID", "not-a-client-id"],
    ["EMAIL_API_KEY", "sk_live_example"],
    ["EMAIL_API_KEY", "re_has space"],
    ["EMAIL_FROM", "MedStore"],
    ["EMAIL_FROM", "MedStore <no-reply>"],
    ["SUPABASE_URL", "http://abcdefghijklmnop.supabase.co"],
    ["SUPABASE_URL", "abcdefghijklmnop.supabase.co"],
    ["SUPABASE_URL", "https://abcdefghijklmnop.supabase.co/rest/v1/"],
    ["SUPABASE_SECRET_KEY", "sb_publishable_example-key"],
    ["SUPABASE_SECRET_KEY", "eyJhbGciOiJIUzI1NiJ9.anon-key.signature"],
    ["SUPABASE_BUCKET", "Prescriptions"],
    ["SUPABASE_BUCKET", "my/bucket"],
    ["BILL_CONFIRMATION_TIMEOUT_MINUTES", "0"],
    ["BILL_CONFIRMATION_TIMEOUT_MINUTES", "1441"],
    ["BILL_CONFIRMATION_TIMEOUT_MINUTES", "7.5"],
  ])("rejects malformed %s (%j) without echoing the value", (key, value) => {
    const message = errorMessage({ ...valid, [key]: value });
    expect(message).toContain(key);
    if (value) expect(message).not.toContain(value);
  });

  it.each([
    ["JWT_ADMIN_ACCESS_SECRET", "JWT_CUSTOMER_ACCESS_SECRET"],
    ["OTP_HMAC_SECRET", "JWT_CUSTOMER_ACCESS_SECRET"],
    ["OTP_HMAC_SECRET", "JWT_ADMIN_ACCESS_SECRET"],
  ])("rejects %s equal to %s without echoing it", (key, other) => {
    const message = errorMessage({ ...valid, [key]: valid[other] });
    expect(message).toContain(`${key}: must differ from ${other}`);
    expect(message).not.toContain(valid[other]);
  });

  it.each([
    ["missing", undefined, undefined],
    ["empty", "", undefined],
    ["set", "expo-access-token", "expo-access-token"],
  ])("treats an EXPO_ACCESS_TOKEN that is %s as optional", (_label, value, expected) => {
    expect(parseEnv({ ...valid, EXPO_ACCESS_TOKEN: value }).EXPO_ACCESS_TOKEN).toBe(expected);
  });

  it("requires at least one proxy hop in production only", () => {
    expect(errorMessage({ ...valid, TRUST_PROXY: "0" })).toContain(
      "TRUST_PROXY: must be at least 1 in production",
    );
    expect(parseEnv({ ...valid, NODE_ENV: "development", TRUST_PROXY: "0" }).TRUST_PROXY).toBe(0);
  });

  it("accepts a bare EMAIL_FROM address", () => {
    expect(parseEnv({ ...valid, EMAIL_FROM: "no-reply@example.com" }).EMAIL_FROM).toBe(
      "no-reply@example.com",
    );
  });
});
