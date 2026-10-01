import { ErrorCodes, OtpPurpose } from "@medstore/shared";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../src/app.js";
import { OtpCode } from "../../../src/modules/auth/otpCode.model.js";
import { User } from "../../../src/modules/users/user.model.js";
import { sendCodeEmail } from "../../../src/services/email.js";
import { AppError } from "../../../src/utils/AppError.js";
import {
  API,
  PASSWORD,
  advanceTime,
  lastSentCode,
  login,
  registerAndVerify,
} from "../../helpers/auth.js";

vi.mock("../../../src/services/email.js", () => ({ sendCodeEmail: vi.fn() }));

const EMAIL = "asha@example.com";
const providerDown = () =>
  new AppError("We couldn't send the email.", 503, ErrorCodes.SERVICE_UNAVAILABLE);

let app;
beforeEach(() => {
  app = createApp();
});
afterEach(() => {
  vi.useRealTimers();
});

const register = (body) => request(app).post(`${API}/auth/register`).send(body);
const verify = (body) => request(app).post(`${API}/auth/verify-email`).send(body);
const resend = (body) => request(app).post(`${API}/auth/resend-code`).send(body);

describe("POST /auth/register", () => {
  it("creates an unverified user, emails a code and returns no tokens", async () => {
    const res = await register({ email: "  Asha@Example.COM ", password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: expect.any(String) });
    const user = await User.findOne({ email: EMAIL }).lean();
    expect(user.emailVerified).toBe(false);
    expect(sendCodeEmail).toHaveBeenCalledWith({
      to: EMAIL,
      code: expect.stringMatching(/^\d{6}$/),
      purpose: OtpPurpose.VERIFY_EMAIL,
    });
  });

  it("stores only an HMAC of the code", async () => {
    await register({ email: EMAIL, password: PASSWORD }).expect(200);
    const otp = await OtpCode.findOne().lean();
    expect(otp.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(otp.codeHash).not.toContain(lastSentCode());
  });

  it("replaces the password of a still-unverified account and sends a new code", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    await register({ email: EMAIL, password: "first password" }).expect(200);
    advanceTime(61_000);

    const res = await register({ email: EMAIL, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(sendCodeEmail).toHaveBeenCalledTimes(2);
    expect(await User.countDocuments()).toBe(1);

    await verify({ email: EMAIL, code: lastSentCode() }).expect(200);
    expect((await login(app, EMAIL, "first password")).status).toBe(401);
    expect((await login(app, EMAIL)).status).toBe(200);
  });

  it("returns 409 EMAIL_ALREADY_REGISTERED for a verified email", async () => {
    await registerAndVerify(app, EMAIL);
    const res = await register({ email: EMAIL, password: PASSWORD });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ success: false, code: ErrorCodes.EMAIL_ALREADY_REGISTERED });
  });

  it("returns 429 TOO_MANY_REQUESTS when re-registering inside the resend cooldown", async () => {
    await register({ email: EMAIL, password: PASSWORD }).expect(200);
    const res = await register({ email: EMAIL, password: PASSWORD });
    expect(res.status).toBe(429);
    expect(res.body.code).toBe(ErrorCodes.TOO_MANY_REQUESTS);
  });

  it("returns 503 when the email fails, keeps the account, and resend-code recovers", async () => {
    vi.mocked(sendCodeEmail).mockRejectedValueOnce(providerDown());

    const res = await register({ email: EMAIL, password: PASSWORD });
    expect(res.status).toBe(503);
    expect(res.body.code).toBe(ErrorCodes.SERVICE_UNAVAILABLE);
    expect(await User.exists({ email: EMAIL })).toBeTruthy();
    expect(await OtpCode.countDocuments()).toBe(0);

    await resend({ email: EMAIL, purpose: OtpPurpose.VERIFY_EMAIL }).expect(200);
    await verify({ email: EMAIL, code: lastSentCode() }).expect(200);
  });

  it.each([
    ["too short", "short"],
    ["too long", "x".repeat(129)],
  ])("rejects a password that is %s with 400 VALIDATION_ERROR", async (_label, password) => {
    const res = await register({ email: EMAIL, password });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(ErrorCodes.VALIDATION_ERROR);
  });

  it("rejects an invalid email with 400 VALIDATION_ERROR", async () => {
    const res = await register({ email: "not-an-email", password: PASSWORD });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(ErrorCodes.VALIDATION_ERROR);
  });
});

describe("POST /auth/verify-email", () => {
  it("verifies the email and returns a session", async () => {
    await register({ email: EMAIL, password: PASSWORD }).expect(200);
    const res = await verify({ email: EMAIL, code: lastSentCode() });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      accessToken: expect.any(String),
      accessTokenExpiresAt: expect.any(String),
      refreshToken: expect.any(String),
      user: {
        id: expect.any(String),
        email: EMAIL,
        emailVerified: true,
        onboardingCompleted: false,
      },
    });
    const me = await request(app)
      .get(`${API}/me`)
      .set("Authorization", `Bearer ${res.body.data.accessToken}`);
    expect(me.status).toBe(200);
  });

  it("returns 400 INVALID_OR_EXPIRED_CODE for an unknown email", async () => {
    const res = await verify({ email: "nobody@example.com", code: "123456" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(ErrorCodes.INVALID_OR_EXPIRED_CODE);
  });

  it("counts wrong codes and locks at 5 with 429 TOO_MANY_ATTEMPTS", async () => {
    await register({ email: EMAIL, password: PASSWORD }).expect(200);
    const code = lastSentCode();
    const wrong = code === "000000" ? "111111" : "000000";

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const res = await verify({ email: EMAIL, code: wrong });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ErrorCodes.INVALID_OR_EXPIRED_CODE);
      expect((await OtpCode.findOne().lean()).attempts).toBe(attempt);
    }
    const locked = await verify({ email: EMAIL, code: wrong });
    expect(locked.status).toBe(429);
    expect(locked.body.code).toBe(ErrorCodes.TOO_MANY_ATTEMPTS);
    expect(await OtpCode.countDocuments()).toBe(0);

    const correctAfterLock = await verify({ email: EMAIL, code });
    expect(correctAfterLock.body.code).toBe(ErrorCodes.INVALID_OR_EXPIRED_CODE);
  });

  it("rejects an expired code even though its document still exists", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    await register({ email: EMAIL, password: PASSWORD }).expect(200);
    advanceTime(10 * 60 * 1000 + 1000);

    const res = await verify({ email: EMAIL, code: lastSentCode() });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(ErrorCodes.INVALID_OR_EXPIRED_CODE);
    expect(await OtpCode.countDocuments()).toBe(1);
  });

  it("does not accept a used code twice", async () => {
    await register({ email: EMAIL, password: PASSWORD }).expect(200);
    const code = lastSentCode();
    await verify({ email: EMAIL, code }).expect(200);

    const res = await verify({ email: EMAIL, code });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(ErrorCodes.INVALID_OR_EXPIRED_CODE);
  });

  it("does not accept a password-reset code", async () => {
    await register({ email: EMAIL, password: PASSWORD }).expect(200);
    await request(app).post(`${API}/auth/forgot-password`).send({ email: EMAIL }).expect(200);

    const res = await verify({ email: EMAIL, code: lastSentCode(OtpPurpose.RESET_PASSWORD) });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(ErrorCodes.INVALID_OR_EXPIRED_CODE);
  });

  it("invalidates the previous code when a new one is issued", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    await register({ email: EMAIL, password: PASSWORD }).expect(200);
    const oldCode = lastSentCode();
    advanceTime(61_000);
    await resend({ email: EMAIL, purpose: OtpPurpose.VERIFY_EMAIL }).expect(200);
    expect(await OtpCode.countDocuments()).toBe(1);

    // A new code can equal the old one by chance (1 in a million); only a different one must fail.
    if (lastSentCode() !== oldCode) {
      const res = await verify({ email: EMAIL, code: oldCode });
      expect(res.body.code).toBe(ErrorCodes.INVALID_OR_EXPIRED_CODE);
    }
    await verify({ email: EMAIL, code: lastSentCode() }).expect(200);
  });
});

describe("POST /auth/resend-code", () => {
  it("answers identically for known and unknown emails and only emails the known one", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    await register({ email: EMAIL, password: PASSWORD }).expect(200);
    advanceTime(61_000);
    vi.mocked(sendCodeEmail).mockClear();

    const known = await resend({ email: EMAIL, purpose: OtpPurpose.VERIFY_EMAIL });
    const unknown = await resend({ email: "nobody@example.com", purpose: OtpPurpose.VERIFY_EMAIL });

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(known.status);
    expect(unknown.body).toEqual(known.body);
    expect(sendCodeEmail).toHaveBeenCalledTimes(1);
  });

  it("sends no verification code to an already verified account", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    await registerAndVerify(app, EMAIL);
    advanceTime(61_000);
    vi.mocked(sendCodeEmail).mockClear();

    await resend({ email: EMAIL, purpose: OtpPurpose.VERIFY_EMAIL }).expect(200);
    expect(sendCodeEmail).not.toHaveBeenCalled();
  });

  it("applies the 60-second cooldown identically to known and unknown emails", async () => {
    await register({ email: EMAIL, password: PASSWORD }).expect(200);
    await resend({ email: "nobody@example.com", purpose: OtpPurpose.VERIFY_EMAIL }).expect(200);

    const known = await resend({ email: EMAIL, purpose: OtpPurpose.VERIFY_EMAIL });
    const unknown = await resend({ email: "nobody@example.com", purpose: OtpPurpose.VERIFY_EMAIL });
    expect(known.status).toBe(429);
    expect(unknown.status).toBe(429);
    expect(unknown.body).toEqual(known.body);
  });

  it("caps sends at 5 per email per hour across purposes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const email = "nobody@example.com";
    const purposes = [OtpPurpose.VERIFY_EMAIL, OtpPurpose.RESET_PASSWORD];
    for (let send = 0; send < 5; send += 1) {
      await resend({ email, purpose: purposes[send % 2] }).expect(200);
      advanceTime(61_000);
    }

    const capped = await resend({ email, purpose: OtpPurpose.RESET_PASSWORD });
    expect(capped.status).toBe(429);
    expect(capped.body.code).toBe(ErrorCodes.TOO_MANY_REQUESTS);

    advanceTime(60 * 60 * 1000);
    await resend({ email, purpose: OtpPurpose.RESET_PASSWORD }).expect(200);
  });

  it("still answers with the generic success when the email provider fails", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    await register({ email: EMAIL, password: PASSWORD }).expect(200);
    advanceTime(61_000);
    vi.mocked(sendCodeEmail).mockRejectedValueOnce(providerDown());

    const res = await resend({ email: EMAIL, purpose: OtpPurpose.VERIFY_EMAIL });
    const unknown = await resend({ email: "nobody@example.com", purpose: OtpPurpose.VERIFY_EMAIL });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(unknown.body);
  });

  it("rejects an unknown purpose with 400 VALIDATION_ERROR", async () => {
    const res = await resend({ email: EMAIL, purpose: "LOGIN" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(ErrorCodes.VALIDATION_ERROR);
  });
});
