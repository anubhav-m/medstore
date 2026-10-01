import { ErrorCodes } from "@medstore/shared";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../src/app.js";
import { Admin } from "../../../src/modules/admins/admin.model.js";
import {
  adminLogin,
  adminLogout,
  adminRefresh,
  expectError,
  signInAdmin,
} from "../../helpers/admin.js";
import { API, advanceTime, registerAndVerify } from "../../helpers/auth.js";

vi.mock("../../../src/services/email.js", () => ({ sendCodeEmail: vi.fn() }));

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

let app;
beforeEach(() => {
  app = createApp();
});
afterEach(() => {
  vi.useRealTimers();
});

const customerRefresh = (refreshToken) =>
  request(app).post(`${API}/auth/refresh`).send({ refreshToken });
const customerLogout = (refreshToken) =>
  request(app).post(`${API}/auth/logout`).send({ refreshToken });

const expectInvalidToken = (res) => expectError(res, 401, ErrorCodes.INVALID_TOKEN);

describe("POST /admin/auth/refresh", () => {
  it("rotates the pair and returns a new session", async () => {
    const session = await signInAdmin(app);
    const res = await adminRefresh(app, session.refreshToken);

    expect(res.status).toBe(200);
    expect(res.body.data.refreshToken).not.toBe(session.refreshToken);
    expect(res.body.data.admin).toEqual(session.admin);
    await adminRefresh(app, res.body.data.refreshToken).expect(200);
  });

  it("rejects the old token after rotation", async () => {
    const session = await signInAdmin(app);
    await adminRefresh(app, session.refreshToken).expect(200);
    expectInvalidToken(await adminRefresh(app, session.refreshToken));
  });

  it("revokes every admin session when a rotated token is reused", async () => {
    const first = await signInAdmin(app);
    const second = (await adminLogin(app)).body.data;
    const rotated = (await adminRefresh(app, first.refreshToken)).body.data;

    expectInvalidToken(await adminRefresh(app, first.refreshToken));
    expectInvalidToken(await adminRefresh(app, rotated.refreshToken));
    expectInvalidToken(await adminRefresh(app, second.refreshToken));
  });

  it("rejects an unknown token", async () => {
    expectInvalidToken(await adminRefresh(app, "not-a-real-token"));
  });

  it("expires admin refresh tokens after 7 days", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const first = await signInAdmin(app);
    const second = (await adminLogin(app)).body.data;

    advanceTime(SEVEN_DAYS_MS - 60_000);
    await adminRefresh(app, first.refreshToken).expect(200);
    advanceTime(2 * 60_000);
    expectInvalidToken(await adminRefresh(app, second.refreshToken));
  });

  it("returns 403 ACCOUNT_DISABLED for a disabled admin", async () => {
    const session = await signInAdmin(app);
    await Admin.updateMany({}, { $set: { isActive: false } });
    expectError(await adminRefresh(app, session.refreshToken), 403, ErrorCodes.ACCOUNT_DISABLED);
  });

  it("rejects a token whose admin no longer exists", async () => {
    const session = await signInAdmin(app);
    await Admin.deleteMany({});
    expectInvalidToken(await adminRefresh(app, session.refreshToken));
  });

  it("keeps working while a password change is required", async () => {
    const session = await signInAdmin(app, { mustChangePassword: true });
    const res = await adminRefresh(app, session.refreshToken);
    expect(res.status).toBe(200);
    expect(res.body.data.admin.mustChangePassword).toBe(true);
  });

  it("limits refreshes per IP with 429 TOO_MANY_REQUESTS", async () => {
    app = createApp({ rateLimits: { refresh: { windowMs: 60_000, limit: 1 } } });
    expectInvalidToken(await adminRefresh(app, "unknown"));
    expectError(await adminRefresh(app, "unknown"), 429, ErrorCodes.TOO_MANY_REQUESTS);
  });
});

describe("refresh tokens never cross between customers and admins", () => {
  it("rejects a customer refresh token on the admin endpoint without burning it", async () => {
    const customer = await registerAndVerify(app, "asha@example.com");
    expectInvalidToken(await adminRefresh(app, customer.refreshToken));
    await customerRefresh(customer.refreshToken).expect(200);
  });

  it("rejects an admin refresh token on the customer endpoint without burning it", async () => {
    const admin = await signInAdmin(app);
    expectInvalidToken(await customerRefresh(admin.refreshToken));
    await adminRefresh(app, admin.refreshToken).expect(200);
  });

  it("doesn't let one world's logout revoke the other's token", async () => {
    const customer = await registerAndVerify(app, "asha@example.com");
    const admin = await signInAdmin(app);

    await adminLogout(app, customer.refreshToken).expect(200);
    await customerLogout(admin.refreshToken).expect(200);
    await customerRefresh(customer.refreshToken).expect(200);
    await adminRefresh(app, admin.refreshToken).expect(200);
  });

  it("leaves customer sessions alone when an admin token is reused", async () => {
    const customer = await registerAndVerify(app, "asha@example.com");
    const admin = await signInAdmin(app);
    await adminRefresh(app, admin.refreshToken).expect(200);
    expectInvalidToken(await adminRefresh(app, admin.refreshToken));
    await customerRefresh(customer.refreshToken).expect(200);
  });
});

describe("POST /admin/auth/logout", () => {
  it("revokes the refresh token", async () => {
    const session = await signInAdmin(app);
    const res = await adminLogout(app, session.refreshToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: "Signed out" });
    expectInvalidToken(await adminRefresh(app, session.refreshToken));
  });

  it("always succeeds, even for unknown or already revoked tokens", async () => {
    const session = await signInAdmin(app);
    await adminLogout(app, session.refreshToken).expect(200);
    await adminLogout(app, session.refreshToken).expect(200);
    await adminLogout(app, "never-issued").expect(200);
  });

  it("leaves the admin's other sessions signed in", async () => {
    const first = await signInAdmin(app);
    const second = (await adminLogin(app)).body.data;
    await adminLogout(app, first.refreshToken).expect(200);
    await adminRefresh(app, second.refreshToken).expect(200);
  });

  it("works while a password change is required", async () => {
    const session = await signInAdmin(app, { mustChangePassword: true });
    await adminLogout(app, session.refreshToken).expect(200);
    expectInvalidToken(await adminRefresh(app, session.refreshToken));
  });
});
