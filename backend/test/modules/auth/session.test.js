import { ErrorCodes } from "@medstore/shared";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../src/app.js";
import { User } from "../../../src/modules/users/user.model.js";
import { API, advanceTime, login, registerAndVerify } from "../../helpers/auth.js";

vi.mock("../../../src/services/email.js", () => ({ sendCodeEmail: vi.fn() }));

const EMAIL = "asha@example.com";

let app;
beforeEach(() => {
  app = createApp();
});
afterEach(() => {
  vi.useRealTimers();
});

const refresh = (refreshToken) => request(app).post(`${API}/auth/refresh`).send({ refreshToken });
const logout = (refreshToken) => request(app).post(`${API}/auth/logout`).send({ refreshToken });

const expectInvalidToken = (res) => {
  expect(res.status).toBe(401);
  expect(res.body).toMatchObject({ success: false, code: ErrorCodes.INVALID_TOKEN });
};

describe("POST /auth/refresh", () => {
  it("rotates the pair and returns a new session", async () => {
    const session = await registerAndVerify(app, EMAIL);
    const res = await refresh(session.refreshToken);

    expect(res.status).toBe(200);
    expect(res.body.data.refreshToken).not.toBe(session.refreshToken);
    expect(res.body.data.user.email).toBe(EMAIL);
    await refresh(res.body.data.refreshToken).expect(200);
  });

  it("rejects the old token after rotation", async () => {
    const session = await registerAndVerify(app, EMAIL);
    await refresh(session.refreshToken).expect(200);
    expectInvalidToken(await refresh(session.refreshToken));
  });

  it("revokes every session when a rotated token is reused", async () => {
    const first = await registerAndVerify(app, EMAIL);
    const second = (await login(app, EMAIL)).body.data;
    const rotated = (await refresh(first.refreshToken)).body.data;

    expectInvalidToken(await refresh(first.refreshToken));
    expectInvalidToken(await refresh(rotated.refreshToken));
    expectInvalidToken(await refresh(second.refreshToken));
  });

  it("rejects an unknown token", async () => {
    expectInvalidToken(await refresh("not-a-real-token"));
  });

  it("rejects an expired token", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const session = await registerAndVerify(app, EMAIL);
    advanceTime(30 * 24 * 60 * 60 * 1000 + 1000);
    expectInvalidToken(await refresh(session.refreshToken));
  });

  it("rejects a token whose user no longer exists", async () => {
    const session = await registerAndVerify(app, EMAIL);
    await User.deleteMany({});
    expectInvalidToken(await refresh(session.refreshToken));
  });

  it("limits refreshes per IP with 429 TOO_MANY_REQUESTS", async () => {
    app = createApp({ rateLimits: { refresh: { windowMs: 60_000, limit: 1 } } });
    expectInvalidToken(await refresh("unknown"));
    const res = await refresh("unknown");
    expect(res.status).toBe(429);
    expect(res.body.code).toBe(ErrorCodes.TOO_MANY_REQUESTS);
  });
});

describe("POST /auth/logout", () => {
  it("revokes the refresh token", async () => {
    const session = await registerAndVerify(app, EMAIL);
    const res = await logout(session.refreshToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: "Signed out" });
    expectInvalidToken(await refresh(session.refreshToken));
  });

  it("always succeeds, even for unknown or already revoked tokens", async () => {
    const session = await registerAndVerify(app, EMAIL);
    await logout(session.refreshToken).expect(200);
    await logout(session.refreshToken).expect(200);
    await logout("never-issued").expect(200);
  });

  it("doesn't treat a logged-out token presented again as reuse", async () => {
    const first = await registerAndVerify(app, EMAIL);
    const second = (await login(app, EMAIL)).body.data;
    await logout(first.refreshToken).expect(200);
    expectInvalidToken(await refresh(first.refreshToken));
    await refresh(second.refreshToken).expect(200);
  });

  it("leaves the user's other sessions signed in", async () => {
    const first = await registerAndVerify(app, EMAIL);
    const second = (await login(app, EMAIL)).body.data;
    await logout(first.refreshToken).expect(200);
    await refresh(second.refreshToken).expect(200);
  });
});
