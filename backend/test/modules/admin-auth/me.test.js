import { ErrorCodes } from "@medstore/shared";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../src/app.js";
import { Admin } from "../../../src/modules/admins/admin.model.js";
import { ADMIN_API, expectError, getAdminMe, signInAdmin } from "../../helpers/admin.js";
import { API, advanceTime, registerAndVerify } from "../../helpers/auth.js";

vi.mock("../../../src/services/email.js", () => ({ sendCodeEmail: vi.fn() }));

const ADMIN_SECRET = process.env.JWT_ADMIN_ACCESS_SECRET;
const CUSTOMER_SECRET = process.env.JWT_CUSTOMER_ACCESS_SECRET;

let app;
beforeEach(() => {
  app = createApp();
});
afterEach(() => {
  vi.useRealTimers();
});

const sign = (payload, secret = ADMIN_SECRET, options = {}) =>
  jwt.sign(payload, secret, { algorithm: "HS256", expiresIn: "15m", ...options });

const base64url = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

const expectInvalidToken = (res) => expectError(res, 401, ErrorCodes.INVALID_TOKEN);

describe("GET /admin/me", () => {
  it("returns exactly the signed-in admin's public fields", async () => {
    const session = await signInAdmin(app);
    const res = await getAdminMe(app, session.accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      message: "Profile loaded",
      data: { admin: session.admin },
    });
    expect(Object.keys(res.body.data.admin).sort()).toEqual(
      ["id", "mustChangePassword", "name", "role", "storeIds", "username"].sort(),
    );
  });

  it("works while a password change is required", async () => {
    const session = await signInAdmin(app, { mustChangePassword: true });
    const res = await getAdminMe(app, session.accessToken);
    expect(res.status).toBe(200);
    expect(res.body.data.admin.mustChangePassword).toBe(true);
  });

  it("returns 403 ACCOUNT_DISABLED for a disabled admin with a still-valid token", async () => {
    const session = await signInAdmin(app);
    await Admin.updateMany({}, { $set: { isActive: false } });
    expectError(await getAdminMe(app, session.accessToken), 403, ErrorCodes.ACCOUNT_DISABLED);
  });

  it("rejects a valid token whose admin was deleted", async () => {
    const session = await signInAdmin(app);
    await Admin.deleteMany({});
    expectInvalidToken(await getAdminMe(app, session.accessToken));
  });

  it("rejects a missing or non-Bearer Authorization header", async () => {
    expectInvalidToken(await request(app).get(`${ADMIN_API}/me`));
    expectInvalidToken(
      await request(app).get(`${ADMIN_API}/me`).set("Authorization", "Basic dXNlcjpwYXNz"),
    );
  });

  it("rejects an expired token with TOKEN_EXPIRED", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const session = await signInAdmin(app);
    advanceTime(15 * 60 * 1000 + 1000);
    expectError(await getAdminMe(app, session.accessToken), 401, ErrorCodes.TOKEN_EXPIRED);
  });

  it("rejects a tampered token", async () => {
    const session = await signInAdmin(app);
    const [header, , signature] = session.accessToken.split(".");
    const payload = base64url({ sub: session.admin.id, aud: "admin", role: "OWNER" });
    expectInvalidToken(await getAdminMe(app, `${header}.${payload}.${signature}`));
  });

  it("rejects an alg: none token", async () => {
    const { admin } = await signInAdmin(app);
    const header = base64url({ alg: "none", typ: "JWT" });
    const payload = base64url({
      sub: admin.id,
      aud: "admin",
      exp: Math.floor(Date.now() / 1000) + 900,
    });
    expectInvalidToken(await getAdminMe(app, `${header}.${payload}.`));
  });

  it("rejects a token signed with an algorithm other than HS256", async () => {
    const { admin } = await signInAdmin(app);
    const token = sign({ sub: admin.id, aud: "admin" }, ADMIN_SECRET, { algorithm: "HS512" });
    expectInvalidToken(await getAdminMe(app, token));
  });

  it("rejects an admin-secret token with aud: customer", async () => {
    const { admin } = await signInAdmin(app);
    expectInvalidToken(await getAdminMe(app, sign({ sub: admin.id, aud: "customer" })));
  });

  it("rejects a customer-secret token claiming aud: admin", async () => {
    const { admin } = await signInAdmin(app);
    const token = sign({ sub: admin.id, aud: "admin" }, CUSTOMER_SECRET);
    expectInvalidToken(await getAdminMe(app, token));
  });

  it("rejects a real customer access token with 401", async () => {
    const customer = await registerAndVerify(app, "asha@example.com");
    expectInvalidToken(await getAdminMe(app, customer.accessToken));
  });

  it("rejects a refresh token used as an access token", async () => {
    const session = await signInAdmin(app);
    expectInvalidToken(await getAdminMe(app, session.refreshToken));
  });

  it("rejects a correctly signed token whose subject is not an id", async () => {
    expectInvalidToken(await getAdminMe(app, sign({ sub: "not-an-id", aud: "admin" })));
  });
});

describe("customer routes refuse admin tokens", () => {
  it("returns 401 for an admin access token on customer GET /me", async () => {
    const session = await signInAdmin(app);
    const res = await request(app)
      .get(`${API}/me`)
      .set("Authorization", `Bearer ${session.accessToken}`);
    expectInvalidToken(res);
  });
});
