import { AdminRole, ErrorCodes } from "@medstore/shared";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { Admin } from "../../src/modules/admins/admin.model.js";
import { ADMIN_API, ADMIN_PASSWORD, adminApi, expectError, signInAdmin } from "../helpers/admin.js";
import { STORE } from "../helpers/store.js";

let app;
beforeEach(() => {
  app = createApp();
});

// GET /admin/stores is a route behind the strict authAdmin.
const getStores = (accessToken) => adminApi(app, accessToken).get("/stores");

describe("authAdmin", () => {
  it("lets an active admin through", async () => {
    const session = await signInAdmin(app);
    expect((await getStores(session.accessToken)).status).toBe(200);
  });

  it("returns 403 PASSWORD_CHANGE_REQUIRED while a password change is required", async () => {
    const session = await signInAdmin(app, { mustChangePassword: true });
    expectError(await getStores(session.accessToken), 403, ErrorCodes.PASSWORD_CHANGE_REQUIRED);
  });

  it("applies a password-change requirement set after the token was issued", async () => {
    const session = await signInAdmin(app);
    await Admin.updateMany({}, { $set: { mustChangePassword: true } });
    expectError(await getStores(session.accessToken), 403, ErrorCodes.PASSWORD_CHANGE_REQUIRED);
  });

  it("opens the gate after the password is changed", async () => {
    const session = await signInAdmin(app, { mustChangePassword: true });
    const changed = await request(app)
      .post(`${ADMIN_API}/auth/change-password`)
      .set("Authorization", `Bearer ${session.accessToken}`)
      .send({ currentPassword: ADMIN_PASSWORD, newPassword: "a brand new password" });
    expect(changed.status).toBe(200);
    expect((await getStores(changed.body.data.accessToken)).status).toBe(200);
  });

  it("reports ACCOUNT_DISABLED before PASSWORD_CHANGE_REQUIRED", async () => {
    const session = await signInAdmin(app, { mustChangePassword: true });
    await Admin.updateMany({}, { $set: { isActive: false } });
    expectError(await getStores(session.accessToken), 403, ErrorCodes.ACCOUNT_DISABLED);
  });

  it("reads the role from the database, not the token", async () => {
    const owner = adminApi(app, (await signInAdmin(app)).accessToken);
    await Admin.updateMany({}, { $set: { role: AdminRole.STAFF } });
    expectError(await owner.post("/stores").send(STORE), 403, ErrorCodes.FORBIDDEN);
  });
});
