import { AdminRole, ErrorCodes } from "@medstore/shared";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../../src/app.js";
import { Admin } from "../../../src/modules/admins/admin.model.js";
import {
  ADMIN_API,
  ADMIN_PASSWORD,
  ADMIN_USERNAME,
  adminLogin,
  createTestAdmin,
  expectError,
} from "../../helpers/admin.js";

let app;
beforeEach(() => {
  app = createApp();
});

describe("POST /admin/auth/login", () => {
  it("signs an admin in with a case-insensitive username and records lastLoginAt", async () => {
    const admin = await createTestAdmin();
    const res = await adminLogin(app, "  Owner.ONE ");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      message: "Signed in",
      data: {
        accessToken: expect.any(String),
        accessTokenExpiresAt: expect.any(String),
        refreshToken: expect.any(String),
        admin: {
          id: admin.id,
          username: ADMIN_USERNAME,
          name: "Owner One",
          role: AdminRole.OWNER,
          storeIds: [],
          mustChangePassword: false,
        },
      },
    });
    const stored = await Admin.findById(admin.id).lean();
    expect(stored.lastLoginAt).toBeInstanceOf(Date);
  });

  it("signs in an admin who must change their password and says so", async () => {
    await createTestAdmin({ mustChangePassword: true });
    const res = await adminLogin(app);
    expect(res.status).toBe(200);
    expect(res.body.data.admin.mustChangePassword).toBe(true);
  });

  it("answers an unknown username and a wrong password identically", async () => {
    await createTestAdmin();
    const wrongPassword = await adminLogin(app, ADMIN_USERNAME, "wrong password!!");
    const unknownUsername = await adminLogin(app, "nobody", "wrong password!!");

    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body).toEqual({
      success: false,
      message: "Invalid username or password",
      code: ErrorCodes.INVALID_CREDENTIALS,
    });
    expect(unknownUsername.status).toBe(wrongPassword.status);
    expect(unknownUsername.body).toEqual(wrongPassword.body);
  });

  it("returns 403 ACCOUNT_DISABLED for a disabled admin with the right password", async () => {
    await createTestAdmin({ isActive: false });
    expectError(await adminLogin(app), 403, ErrorCodes.ACCOUNT_DISABLED);
  });

  it("checks the password before revealing that an account is disabled", async () => {
    await createTestAdmin({ isActive: false });
    expectError(
      await adminLogin(app, ADMIN_USERNAME, "wrong password!!"),
      401,
      ErrorCodes.INVALID_CREDENTIALS,
    );
  });

  it.each([
    ["a missing password", { username: ADMIN_USERNAME }],
    ["a missing username", { password: ADMIN_PASSWORD }],
    ["an operator as the username", { username: { $ne: null }, password: ADMIN_PASSWORD }],
    ["an extra field", { username: ADMIN_USERNAME, password: ADMIN_PASSWORD, role: "OWNER" }],
  ])("rejects %s with 400 VALIDATION_ERROR", async (_case, body) => {
    await createTestAdmin();
    const res = await request(app).post(`${ADMIN_API}/auth/login`).send(body);
    expectError(res, 400, ErrorCodes.VALIDATION_ERROR);
  });
});

describe("admin login rate limits", () => {
  it("limits failed attempts per username, across IPs and letter case", async () => {
    app = createApp({ rateLimits: { adminLogin: { windowMs: 60_000, limit: 2 } } });
    await createTestAdmin();
    await adminLogin(app, ADMIN_USERNAME, "wrong password!!").expect(401);
    await adminLogin(app, "OWNER.ONE", "wrong password!!").expect(401);

    // Even the right password waits for the window: the limit is per username.
    expectError(await adminLogin(app), 429, ErrorCodes.TOO_MANY_REQUESTS);
    await adminLogin(app, "someone.else", "wrong password!!").expect(401);
  });

  it("doesn't count successful logins toward the per-username limit", async () => {
    app = createApp({ rateLimits: { adminLogin: { windowMs: 60_000, limit: 2 } } });
    await createTestAdmin();
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await adminLogin(app).expect(200);
    }
  });

  it("limits failed attempts per IP across usernames", async () => {
    app = createApp({ rateLimits: { adminLoginIp: { windowMs: 60_000, limit: 2 } } });
    await adminLogin(app, "first.name", "wrong password!!").expect(401);
    await adminLogin(app, "second.name", "wrong password!!").expect(401);
    expectError(
      await adminLogin(app, "third.name", "wrong password!!"),
      429,
      ErrorCodes.TOO_MANY_REQUESTS,
    );
  });
});
