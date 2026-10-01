import { ErrorCodes } from "@medstore/shared";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { authAdmin } from "../../src/middleware/authAdmin.js";
import { errorHandler } from "../../src/middleware/errorHandler.js";
import { Admin } from "../../src/modules/admins/admin.model.js";
import { sendSuccess } from "../../src/utils/sendSuccess.js";
import { ADMIN_API, ADMIN_PASSWORD, expectError, signInAdmin } from "../helpers/admin.js";

// No production route uses the strict authAdmin yet (the first ones arrive with stores), so the
// gate is exercised on a route that exists only here.
const gatedApp = express()
  .get("/gated", authAdmin, (req, res) => sendSuccess(res, { message: "ok", data: req.admin }))
  .use(errorHandler);

const getGated = (accessToken) =>
  request(gatedApp).get("/gated").set("Authorization", `Bearer ${accessToken}`);

let app;
beforeEach(() => {
  app = createApp();
});

describe("authAdmin", () => {
  it("lets an active admin through with req.admin set", async () => {
    const session = await signInAdmin(app);
    const res = await getGated(session.accessToken);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: session.admin.id });
  });

  it("returns 403 PASSWORD_CHANGE_REQUIRED while a password change is required", async () => {
    const session = await signInAdmin(app, { mustChangePassword: true });
    expectError(await getGated(session.accessToken), 403, ErrorCodes.PASSWORD_CHANGE_REQUIRED);
  });

  it("applies a password-change requirement set after the token was issued", async () => {
    const session = await signInAdmin(app);
    await Admin.updateMany({}, { $set: { mustChangePassword: true } });
    expectError(await getGated(session.accessToken), 403, ErrorCodes.PASSWORD_CHANGE_REQUIRED);
  });

  it("opens the gate after the password is changed", async () => {
    const session = await signInAdmin(app, { mustChangePassword: true });
    const changed = await request(app)
      .post(`${ADMIN_API}/auth/change-password`)
      .set("Authorization", `Bearer ${session.accessToken}`)
      .send({ currentPassword: ADMIN_PASSWORD, newPassword: "a brand new password" });
    expect(changed.status).toBe(200);
    await getGated(changed.body.data.accessToken).expect(200);
  });

  it("reports ACCOUNT_DISABLED before PASSWORD_CHANGE_REQUIRED", async () => {
    const session = await signInAdmin(app, { mustChangePassword: true });
    await Admin.updateMany({}, { $set: { isActive: false } });
    expectError(await getGated(session.accessToken), 403, ErrorCodes.ACCOUNT_DISABLED);
  });
});
