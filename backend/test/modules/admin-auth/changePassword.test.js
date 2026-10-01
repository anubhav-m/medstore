import { ErrorCodes } from "@medstore/shared";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../../src/app.js";
import { Admin } from "../../../src/modules/admins/admin.model.js";
import {
  ADMIN_API,
  ADMIN_PASSWORD,
  ADMIN_USERNAME,
  adminLogin,
  adminRefresh,
  expectError,
  signInAdmin,
} from "../../helpers/admin.js";

const NEW_PASSWORD = "a brand new password";

let app;
beforeEach(() => {
  app = createApp();
});

const changePassword = (accessToken, body) => {
  const req = request(app).post(`${ADMIN_API}/auth/change-password`);
  return (accessToken ? req.set("Authorization", `Bearer ${accessToken}`) : req).send(body);
};

const validBody = { currentPassword: ADMIN_PASSWORD, newPassword: NEW_PASSWORD };

describe("POST /admin/auth/change-password", () => {
  it("changes the password, clears mustChangePassword and returns a fresh session", async () => {
    const session = await signInAdmin(app, { mustChangePassword: true });
    const res = await changePassword(session.accessToken, validBody);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      message: "Password changed",
      data: {
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        admin: { ...session.admin, mustChangePassword: false },
      },
    });
    expect((await Admin.findOne().lean()).mustChangePassword).toBe(false);
    expect((await adminLogin(app, ADMIN_USERNAME, ADMIN_PASSWORD)).status).toBe(401);
    await adminLogin(app, ADMIN_USERNAME, NEW_PASSWORD).expect(200);
  });

  it("revokes every earlier session but keeps the fresh one", async () => {
    const session = await signInAdmin(app);
    const otherDevice = (await adminLogin(app)).body.data;
    const res = await changePassword(session.accessToken, validBody);

    expectError(await adminRefresh(app, session.refreshToken), 401, ErrorCodes.INVALID_TOKEN);
    expectError(await adminRefresh(app, otherDevice.refreshToken), 401, ErrorCodes.INVALID_TOKEN);
    await adminRefresh(app, res.body.data.refreshToken).expect(200);
  });

  it("returns 401 INVALID_CREDENTIALS for a wrong current password", async () => {
    const session = await signInAdmin(app);
    const res = await changePassword(session.accessToken, {
      currentPassword: "not my password",
      newPassword: NEW_PASSWORD,
    });
    expectError(res, 401, ErrorCodes.INVALID_CREDENTIALS);
    await adminLogin(app).expect(200);
  });

  it.each([
    ["the same as the current one", ADMIN_PASSWORD],
    ["shorter than 12 characters", "x".repeat(11)],
    ["longer than 128 characters", "x".repeat(129)],
  ])("rejects a new password %s with 400 VALIDATION_ERROR", async (_case, newPassword) => {
    const session = await signInAdmin(app);
    const res = await changePassword(session.accessToken, {
      currentPassword: ADMIN_PASSWORD,
      newPassword,
    });
    expectError(res, 400, ErrorCodes.VALIDATION_ERROR);
    expect(res.body.errors).toEqual([{ field: "newPassword", message: expect.any(String) }]);
  });

  it("accepts a 12-character new password", async () => {
    const session = await signInAdmin(app);
    const res = await changePassword(session.accessToken, {
      currentPassword: ADMIN_PASSWORD,
      newPassword: "x".repeat(12),
    });
    expect(res.status).toBe(200);
  });

  it("rejects an extra field", async () => {
    const session = await signInAdmin(app);
    const res = await changePassword(session.accessToken, { ...validBody, role: "OWNER" });
    expectError(res, 400, ErrorCodes.VALIDATION_ERROR);
  });

  it("requires an admin access token", async () => {
    expectError(await changePassword(undefined, validBody), 401, ErrorCodes.INVALID_TOKEN);
  });

  it("returns 403 ACCOUNT_DISABLED for a disabled admin", async () => {
    const session = await signInAdmin(app);
    await Admin.updateMany({}, { $set: { isActive: false } });
    expectError(
      await changePassword(session.accessToken, validBody),
      403,
      ErrorCodes.ACCOUNT_DISABLED,
    );
  });

  it("counts wrong current passwords toward the per-IP limit", async () => {
    app = createApp({ rateLimits: { adminLoginIp: { windowMs: 60_000, limit: 2 } } });
    const session = await signInAdmin(app);
    const wrong = { currentPassword: "not my password", newPassword: NEW_PASSWORD };
    await changePassword(session.accessToken, wrong).expect(401);
    await changePassword(session.accessToken, wrong).expect(401);
    expectError(
      await changePassword(session.accessToken, validBody),
      429,
      ErrorCodes.TOO_MANY_REQUESTS,
    );
  });
});
