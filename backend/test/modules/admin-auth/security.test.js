import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../../src/app.js";
import { Admin } from "../../../src/modules/admins/admin.model.js";
import { RefreshToken } from "../../../src/modules/auth/refreshToken.model.js";
import {
  ADMIN_API,
  ADMIN_PASSWORD,
  adminLogin,
  adminLogout,
  adminRefresh,
  getAdminMe,
  signInAdmin,
} from "../../helpers/admin.js";

let app;
beforeEach(() => {
  app = createApp();
});

describe("admin auth responses", () => {
  it("never contain the password, password hash or refresh-token hashes", async () => {
    const responses = [];
    const record = async (pending) => {
      const res = await pending;
      responses.push(JSON.stringify(res.body));
      return res;
    };

    const session = await signInAdmin(app, { mustChangePassword: true });
    await record(adminLogin(app));
    await record(adminLogin(app, "nobody", "wrong password!!"));
    const refreshed = await record(adminRefresh(app, session.refreshToken));
    await record(getAdminMe(app, refreshed.body.data.accessToken));
    const changed = await record(
      request(app)
        .post(`${ADMIN_API}/auth/change-password`)
        .set("Authorization", `Bearer ${refreshed.body.data.accessToken}`)
        .send({ currentPassword: ADMIN_PASSWORD, newPassword: "a brand new password" }),
    );
    await record(adminLogout(app, changed.body.data.refreshToken));

    const admins = await Admin.find().select("+passwordHash").lean();
    const secrets = [
      "passwordHash",
      "tokenHash",
      ADMIN_PASSWORD,
      "a brand new password",
      ...admins.map((admin) => admin.passwordHash),
      ...(await RefreshToken.find().lean()).map((token) => token.tokenHash),
    ];
    for (const body of responses) {
      for (const secret of secrets) expect(body).not.toContain(secret);
    }
  });

  it("strips passwordHash from an admin document's JSON", async () => {
    await signInAdmin(app);
    const admin = await Admin.findOne().select("+passwordHash");
    expect(admin.passwordHash).toEqual(expect.any(String));
    expect(admin.toJSON()).not.toHaveProperty("passwordHash");
    expect(admin.toJSON()).not.toHaveProperty("__v");
  });
});
