import { describe, expect, it } from "vitest";
import { parseEnv } from "../src/config/env.js";

const valid = {
  NODE_ENV: "production",
  PORT: "4000",
  MONGODB_URI: "mongodb+srv://user:s3cret@cluster.example.net/medstore",
  LOG_LEVEL: "info",
  TRUST_PROXY: "1",
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
  ])("rejects malformed %s (%j) without echoing the value", (key, value) => {
    const message = errorMessage({ ...valid, [key]: value });
    expect(message).toContain(key);
    if (value) expect(message).not.toContain(value);
  });
});
