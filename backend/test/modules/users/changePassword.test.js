import { ErrorCodes } from "@medstore/shared";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../src/app.js";
import { User } from "../../../src/modules/users/user.model.js";
import { verifyGoogleIdToken } from "../../../src/services/googleAuth.js";
import { expectError, signInAdmin } from "../../helpers/admin.js";
import { API, PASSWORD, login, registerAndVerify } from "../../helpers/auth.js";
import { pushToken } from "../../helpers/push.js";

vi.mock("../../../src/services/email.js", () => ({ sendCodeEmail: vi.fn() }));
vi.mock("../../../src/services/googleAuth.js", () => ({ verifyGoogleIdToken: vi.fn() }));

const EMAIL = "asha@example.com";
const NEW_PASSWORD = "a brand new password";

let app;
beforeEach(() => {
  app = createApp();
});

const changePassword = (accessToken, body) => {
  const req = request(app).post(`${API}/me/password`);
  return (accessToken ? req.set("Authorization", `Bearer ${accessToken}`) : req).send(body);
};
const refresh = (refreshToken) => request(app).post(`${API}/auth/refresh`).send({ refreshToken });
const getMe = (accessToken) =>
  request(app).get(`${API}/me`).set("Authorization", `Bearer ${accessToken}`);

describe("POST /me/password", () => {
  it("changes the password and returns a fresh session, before onboarding too", async () => {
    const session = await registerAndVerify(app, EMAIL);

    const res = await changePassword(session.accessToken, {
      currentPassword: PASSWORD,
      newPassword: NEW_PASSWORD,
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Password changed");
    expect(res.body.data).toEqual({
      accessToken: expect.any(String),
      accessTokenExpiresAt: expect.any(String),
      refreshToken: expect.any(String),
      user: { id: session.user.id, email: EMAIL, emailVerified: true, onboardingCompleted: false },
    });
    expect(JSON.stringify(res.body)).not.toContain(NEW_PASSWORD);
    await login(app, EMAIL, NEW_PASSWORD).expect(200);
    expectError(await login(app, EMAIL, PASSWORD), 401, ErrorCodes.INVALID_CREDENTIALS);
  });

  it("signs out every other device and clears push tokens, keeping the fresh session", async () => {
    const session = await registerAndVerify(app, EMAIL);
    const other = (await login(app, EMAIL).expect(200)).body.data;
    await User.updateOne(
      { _id: session.user.id },
      { $set: { pushTokens: [{ token: pushToken(1), createdAt: new Date() }] } },
    );

    const res = await changePassword(session.accessToken, {
      currentPassword: PASSWORD,
      newPassword: NEW_PASSWORD,
    });

    expectError(await refresh(session.refreshToken), 401, ErrorCodes.INVALID_TOKEN);
    expectError(await refresh(other.refreshToken), 401, ErrorCodes.INVALID_TOKEN);
    await refresh(res.body.data.refreshToken).expect(200);
    expect((await User.findById(session.user.id).lean()).pushTokens).toEqual([]);
  });

  it("returns 401 INVALID_CREDENTIALS for a wrong current password and changes nothing", async () => {
    const session = await registerAndVerify(app, EMAIL);

    const res = await changePassword(session.accessToken, {
      currentPassword: "wrong password",
      newPassword: NEW_PASSWORD,
    });

    expectError(res, 401, ErrorCodes.INVALID_CREDENTIALS);
    await getMe(session.accessToken).expect(200);
    await login(app, EMAIL).expect(200);
  });

  it("returns 401 INVALID_CREDENTIALS for an account without a password", async () => {
    vi.mocked(verifyGoogleIdToken).mockResolvedValueOnce({
      googleId: "google-sub-123",
      email: EMAIL,
      emailVerified: true,
    });
    const google = await request(app).post(`${API}/auth/google`).send({ idToken: "t" });

    const res = await changePassword(google.body.data.accessToken, {
      currentPassword: "anything at all",
      newPassword: NEW_PASSWORD,
    });

    expectError(res, 401, ErrorCodes.INVALID_CREDENTIALS);
    expect((await User.findOne({ email: EMAIL }).select("+passwordHash").lean()).passwordHash).toBe(
      null,
    );
  });

  it.each([
    ["the same password", { currentPassword: PASSWORD, newPassword: PASSWORD }],
    ["a short new password", { currentPassword: PASSWORD, newPassword: "short" }],
    ["a missing current password", { newPassword: NEW_PASSWORD }],
    ["an extra field", { currentPassword: PASSWORD, newPassword: NEW_PASSWORD, email: "x@y.co" }],
  ])("rejects %s with 400 VALIDATION_ERROR", async (_case, body) => {
    const session = await registerAndVerify(app, EMAIL);
    expectError(await changePassword(session.accessToken, body), 400, ErrorCodes.VALIDATION_ERROR);
  });

  it("requires a customer access token: none or an admin's → 401 INVALID_TOKEN", async () => {
    const body = { currentPassword: PASSWORD, newPassword: NEW_PASSWORD };
    const admin = await signInAdmin(app);
    expectError(await changePassword(undefined, body), 401, ErrorCodes.INVALID_TOKEN);
    expectError(await changePassword(admin.accessToken, body), 401, ErrorCodes.INVALID_TOKEN);
  });

  it("shares the per-customer re-authentication limit with account deletion", async () => {
    app = createApp({ rateLimits: { customerReauth: { windowMs: 60_000, limit: 2 } } });
    const session = await registerAndVerify(app, EMAIL);
    const wrong = { currentPassword: "wrong password", newPassword: NEW_PASSWORD };

    expectError(
      await changePassword(session.accessToken, wrong),
      401,
      ErrorCodes.INVALID_CREDENTIALS,
    );
    const deletion = await request(app)
      .delete(`${API}/me`)
      .set("Authorization", `Bearer ${session.accessToken}`)
      .send({ password: "wrong password" });
    expectError(deletion, 401, ErrorCodes.INVALID_CREDENTIALS);

    const limited = await changePassword(session.accessToken, {
      currentPassword: PASSWORD,
      newPassword: NEW_PASSWORD,
    });
    expectError(limited, 429, ErrorCodes.TOO_MANY_REQUESTS);
    await login(app, EMAIL).expect(200);
  });
});
