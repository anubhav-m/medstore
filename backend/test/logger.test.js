import { describe, expect, it } from "vitest";
import { createLogger } from "../src/config/logger.js";

const captureLog = (entry) => {
  const lines = [];
  const destination = { write: (chunk) => lines.push(chunk) };
  createLogger({ level: "info", destination }).info(entry, "test entry");
  return JSON.parse(lines[0]);
};

describe("logger redaction", () => {
  it("redacts credentials, codes and personal data", () => {
    const logged = captureLog({
      req: {
        headers: { authorization: "Bearer abc.def", cookie: "sid=1" },
        body: { code: "123456" },
      },
      password: "hunter22",
      user: { refreshToken: "refresh-secret", phone: "+919876543210" },
      order: { patientName: "Asha", deliveryAddress: { line1: "12 MG Road" } },
    });

    expect(logged.req.headers.authorization).toBe("[REDACTED]");
    expect(logged.req.headers.cookie).toBe("[REDACTED]");
    expect(logged.req.body.code).toBe("[REDACTED]");
    expect(logged.password).toBe("[REDACTED]");
    expect(logged.user.refreshToken).toBe("[REDACTED]");
    expect(logged.user.phone).toBe("[REDACTED]");
    expect(logged.order.patientName).toBe("[REDACTED]");
    expect(logged.order.deliveryAddress).toBe("[REDACTED]");
  });

  it("redacts auth request bodies: passwords, codes and tokens", () => {
    const logged = captureLog({
      req: {
        body: {
          email: "asha@example.com",
          password: "hunter22",
          newPassword: "hunter23",
          code: "654321",
          idToken: "google-id-token",
          refreshToken: "refresh-secret",
        },
      },
      session: { accessToken: "access-secret" },
    });

    for (const key of ["password", "newPassword", "code", "idToken", "refreshToken"]) {
      expect(logged.req.body[key]).toBe("[REDACTED]");
    }
    expect(logged.session.accessToken).toBe("[REDACTED]");
  });

  it("keeps error codes visible", () => {
    const logged = captureLog({ code: "VALIDATION_ERROR", err: { code: "STORE_CLOSED" } });
    expect(logged.code).toBe("VALIDATION_ERROR");
    expect(logged.err.code).toBe("STORE_CLOSED");
  });
});
