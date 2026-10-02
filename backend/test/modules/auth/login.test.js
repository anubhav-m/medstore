import { ErrorCodes, OtpPurpose } from "@medstore/shared";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../src/app.js";
import { User } from "../../../src/modules/users/user.model.js";
import { sendCodeEmail } from "../../../src/services/email.js";
import { verifyGoogleIdToken } from "../../../src/services/googleAuth.js";
import { AppError } from "../../../src/utils/AppError.js";
import { API, PASSWORD, advanceTime, login, registerAndVerify } from "../../helpers/auth.js";

vi.mock("../../../src/services/email.js", () => ({ sendCodeEmail: vi.fn() }));
vi.mock("../../../src/services/googleAuth.js", () => ({ verifyGoogleIdToken: vi.fn() }));

const EMAIL = "asha@example.com";
const GOOGLE_ID = "google-sub-123";

let app;
beforeEach(() => {
  app = createApp();
});
afterEach(() => {
  vi.useRealTimers();
});

const googleSignIn = (profile) => {
  vi.mocked(verifyGoogleIdToken).mockResolvedValueOnce({
    googleId: GOOGLE_ID,
    email: EMAIL,
    emailVerified: true,
    ...profile,
  });
  return request(app).post(`${API}/auth/google`).send({ idToken: "google-id-token" });
};

describe("POST /auth/login", () => {
  it("signs a verified user in", async () => {
    await registerAndVerify(app, EMAIL);
    const res = await login(app, " ASHA@example.com ");

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      user: { email: EMAIL, emailVerified: true },
    });
  });

  it("answers an unknown email and a wrong password identically", async () => {
    await registerAndVerify(app, EMAIL);
    const wrongPassword = await login(app, EMAIL, "wrong password");
    const unknownEmail = await login(app, "nobody@example.com", "wrong password");

    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body).toEqual({
      success: false,
      message: "Invalid email or password",
      code: ErrorCodes.INVALID_CREDENTIALS,
    });
    expect(unknownEmail.status).toBe(wrongPassword.status);
    expect(unknownEmail.body).toEqual(wrongPassword.body);
  });

  it("returns 401 INVALID_CREDENTIALS for a Google-only account", async () => {
    await googleSignIn().expect(200);
    const res = await login(app, EMAIL);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(ErrorCodes.INVALID_CREDENTIALS);
  });

  it("returns 403 EMAIL_NOT_VERIFIED with a correct password and sends a new code", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    await request(app).post(`${API}/auth/register`).send({ email: EMAIL, password: PASSWORD });
    advanceTime(61_000);
    vi.mocked(sendCodeEmail).mockClear();

    const res = await login(app, EMAIL);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(ErrorCodes.EMAIL_NOT_VERIFIED);
    expect(sendCodeEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: EMAIL, purpose: OtpPurpose.VERIFY_EMAIL }),
    );
  });

  it("respects the resend cooldown when an unverified login sends a code", async () => {
    await request(app).post(`${API}/auth/register`).send({ email: EMAIL, password: PASSWORD });
    vi.mocked(sendCodeEmail).mockClear();

    const res = await login(app, EMAIL);
    expect(res.status).toBe(403);
    expect(sendCodeEmail).not.toHaveBeenCalled();
  });

  it("checks the password before revealing that an account is unverified", async () => {
    await request(app).post(`${API}/auth/register`).send({ email: EMAIL, password: PASSWORD });
    const res = await login(app, EMAIL, "wrong password");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(ErrorCodes.INVALID_CREDENTIALS);
  });

  it("limits attempts per IP and email with 429 TOO_MANY_REQUESTS", async () => {
    app = createApp({ rateLimits: { customerLogin: { windowMs: 60_000, limit: 2 } } });
    await login(app, EMAIL, "wrong password").expect(401);
    await login(app, EMAIL.toUpperCase(), "wrong password").expect(401);

    const limited = await login(app, EMAIL, "wrong password");
    expect(limited.status).toBe(429);
    expect(limited.body.code).toBe(ErrorCodes.TOO_MANY_REQUESTS);
    await login(app, "other@example.com", "wrong password").expect(401);
  });

  it("limits failed attempts per IP across emails, not counting successful logins", async () => {
    app = createApp({ rateLimits: { customerLoginIp: { windowMs: 60_000, limit: 2 } } });
    await registerAndVerify(app, EMAIL);
    await login(app, EMAIL).expect(200);
    await login(app, "one@example.com", "wrong password").expect(401);
    await login(app, "two@example.com", "wrong password").expect(401);

    const limited = await login(app, "three@example.com", "wrong password");
    expect(limited.status).toBe(429);
    expect(limited.body.code).toBe(ErrorCodes.TOO_MANY_REQUESTS);
  });
});

describe("POST /auth/google", () => {
  it("creates a verified user without a password", async () => {
    const res = await googleSignIn();

    expect(res.status).toBe(200);
    expect(res.body.data.user).toEqual({
      id: expect.any(String),
      email: EMAIL,
      emailVerified: true,
      onboardingCompleted: false,
    });
    const user = await User.findOne({ email: EMAIL }).select("+passwordHash +googleId").lean();
    expect(user.passwordHash).toBeNull();
    expect(user.googleId).toBe(GOOGLE_ID);
  });

  it("matches by googleId first, even when the Google email changed", async () => {
    const first = await googleSignIn();
    const second = await googleSignIn({ email: "renamed@example.com" });
    expect(second.status).toBe(200);
    expect(second.body.data.user.id).toBe(first.body.data.user.id);
    expect(await User.countDocuments()).toBe(1);
  });

  it("links to a verified password account by email and keeps its password", async () => {
    const session = await registerAndVerify(app, EMAIL);
    const res = await googleSignIn({ email: "Asha@Example.com" });

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(session.user.id);
    expect(await User.countDocuments()).toBe(1);
    await login(app, EMAIL).expect(200);
  });

  it("removes the password of an unverified account it links to", async () => {
    await request(app).post(`${API}/auth/register`).send({ email: EMAIL, password: PASSWORD });
    const res = await googleSignIn();

    expect(res.status).toBe(200);
    expect(res.body.data.user.emailVerified).toBe(true);
    const user = await User.findOne({ email: EMAIL }).select("+passwordHash").lean();
    expect(user.passwordHash).toBeNull();
    expect((await login(app, EMAIL)).status).toBe(401);
  });

  it("returns 401 INVALID_CREDENTIALS when Google hasn't verified the email", async () => {
    const res = await googleSignIn({ emailVerified: false });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(ErrorCodes.INVALID_CREDENTIALS);
    expect(await User.countDocuments()).toBe(0);
  });

  it("returns 401 INVALID_CREDENTIALS for an invalid token", async () => {
    vi.mocked(verifyGoogleIdToken).mockRejectedValueOnce(
      new AppError("Google sign-in failed", 401, ErrorCodes.INVALID_CREDENTIALS),
    );
    const res = await request(app).post(`${API}/auth/google`).send({ idToken: "forged" });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(ErrorCodes.INVALID_CREDENTIALS);
  });

  it("refuses an email already linked to a different Google account", async () => {
    await googleSignIn().expect(200);
    const res = await googleSignIn({ googleId: "another-google-sub" });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(ErrorCodes.INVALID_CREDENTIALS);
  });

  it("rejects a missing idToken with 400 VALIDATION_ERROR", async () => {
    const res = await request(app).post(`${API}/auth/google`).send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(ErrorCodes.VALIDATION_ERROR);
  });
});
