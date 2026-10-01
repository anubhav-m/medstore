import { ErrorCodes, OtpPurpose } from "@medstore/shared";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../src/app.js";
import { OtpCode } from "../../../src/modules/auth/otpCode.model.js";
import { sendCodeEmail } from "../../../src/services/email.js";
import { verifyGoogleIdToken } from "../../../src/services/googleAuth.js";
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
vi.mock("../../../src/services/googleAuth.js", () => ({ verifyGoogleIdToken: vi.fn() }));

const EMAIL = "asha@example.com";
const NEW_PASSWORD = "a brand new password";

let app;
beforeEach(() => {
  app = createApp();
});
afterEach(() => {
  vi.useRealTimers();
});

const forgot = (email) => request(app).post(`${API}/auth/forgot-password`).send({ email });
const reset = (body) =>
  request(app)
    .post(`${API}/auth/reset-password`)
    .send({ email: EMAIL, newPassword: NEW_PASSWORD, ...body });
const resetCode = () => lastSentCode(OtpPurpose.RESET_PASSWORD);

describe("POST /auth/forgot-password", () => {
  it("answers identically for existing and unknown emails and only emails the existing one", async () => {
    await registerAndVerify(app, EMAIL);
    vi.mocked(sendCodeEmail).mockClear();

    const existing = await forgot(EMAIL);
    const unknown = await forgot("nobody@example.com");

    expect(existing.status).toBe(200);
    expect(unknown.status).toBe(existing.status);
    expect(unknown.body).toEqual(existing.body);
    expect(sendCodeEmail).toHaveBeenCalledTimes(1);
    expect(sendCodeEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: EMAIL, purpose: OtpPurpose.RESET_PASSWORD }),
    );
  });

  it("still answers with the generic success when the email provider fails", async () => {
    await registerAndVerify(app, EMAIL);
    vi.mocked(sendCodeEmail).mockRejectedValueOnce(
      new AppError("down", 503, ErrorCodes.SERVICE_UNAVAILABLE),
    );
    const existing = await forgot(EMAIL);
    const unknown = await forgot("nobody@example.com");
    expect(existing.status).toBe(200);
    expect(existing.body).toEqual(unknown.body);
  });

  it("returns 429 TOO_MANY_REQUESTS inside the cooldown", async () => {
    await forgot(EMAIL).expect(200);
    const res = await forgot(EMAIL);
    expect(res.status).toBe(429);
    expect(res.body.code).toBe(ErrorCodes.TOO_MANY_REQUESTS);
  });
});

describe("POST /auth/reset-password", () => {
  it("sets the new password, revokes every session and returns no tokens", async () => {
    const session = await registerAndVerify(app, EMAIL);
    await forgot(EMAIL).expect(200);

    const res = await reset({ code: resetCode() });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: expect.any(String) });

    const refresh = await request(app)
      .post(`${API}/auth/refresh`)
      .send({ refreshToken: session.refreshToken });
    expect(refresh.body.code).toBe(ErrorCodes.INVALID_TOKEN);
    expect((await login(app, EMAIL)).status).toBe(401);
    expect((await login(app, EMAIL, NEW_PASSWORD)).status).toBe(200);
  });

  it("verifies the email of an unverified account", async () => {
    await request(app).post(`${API}/auth/register`).send({ email: EMAIL, password: PASSWORD });
    await forgot(EMAIL).expect(200);
    await reset({ code: resetCode() }).expect(200);

    const res = await login(app, EMAIL, NEW_PASSWORD);
    expect(res.status).toBe(200);
    expect(res.body.data.user.emailVerified).toBe(true);
  });

  it("lets a Google-only account add a password", async () => {
    vi.mocked(verifyGoogleIdToken).mockResolvedValueOnce({
      googleId: "google-sub",
      email: EMAIL,
      emailVerified: true,
    });
    await request(app).post(`${API}/auth/google`).send({ idToken: "token" }).expect(200);
    await forgot(EMAIL).expect(200);
    await reset({ code: resetCode() }).expect(200);
    await login(app, EMAIL, NEW_PASSWORD).expect(200);
  });

  it("does not accept an email-verification code", async () => {
    await request(app).post(`${API}/auth/register`).send({ email: EMAIL, password: PASSWORD });
    const res = await reset({ code: lastSentCode(OtpPurpose.VERIFY_EMAIL) });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(ErrorCodes.INVALID_OR_EXPIRED_CODE);
  });

  it("returns 400 INVALID_OR_EXPIRED_CODE for an unknown email", async () => {
    const res = await reset({ email: "nobody@example.com", code: "123456" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(ErrorCodes.INVALID_OR_EXPIRED_CODE);
  });

  it("rejects an expired code even though its document still exists", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    await registerAndVerify(app, EMAIL);
    await forgot(EMAIL).expect(200);
    advanceTime(10 * 60 * 1000 + 1000);

    const res = await reset({ code: resetCode() });
    expect(res.body.code).toBe(ErrorCodes.INVALID_OR_EXPIRED_CODE);
    expect(await OtpCode.countDocuments({ purpose: OtpPurpose.RESET_PASSWORD })).toBe(1);
  });

  it("locks the code at 5 wrong attempts with 429 TOO_MANY_ATTEMPTS", async () => {
    await registerAndVerify(app, EMAIL);
    await forgot(EMAIL).expect(200);
    const wrong = resetCode() === "000000" ? "111111" : "000000";

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      expect((await reset({ code: wrong })).body.code).toBe(ErrorCodes.INVALID_OR_EXPIRED_CODE);
    }
    const locked = await reset({ code: wrong });
    expect(locked.status).toBe(429);
    expect(locked.body.code).toBe(ErrorCodes.TOO_MANY_ATTEMPTS);
    expect((await reset({ code: resetCode() })).status).toBe(400);
  });

  it("does not accept a used code twice", async () => {
    await registerAndVerify(app, EMAIL);
    await forgot(EMAIL).expect(200);
    const code = resetCode();
    await reset({ code }).expect(200);

    const res = await reset({ code, newPassword: "yet another password" });
    expect(res.body.code).toBe(ErrorCodes.INVALID_OR_EXPIRED_CODE);
  });

  it("rejects a too-short new password with 400 VALIDATION_ERROR", async () => {
    const res = await reset({ code: "123456", newPassword: "short" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(ErrorCodes.VALIDATION_ERROR);
  });
});
