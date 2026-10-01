import { ErrorCodes, OtpPurpose } from "@medstore/shared";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../src/app.js";
import { OtpCode } from "../../../src/modules/auth/otpCode.model.js";
import { RefreshToken } from "../../../src/modules/auth/refreshToken.model.js";
import { User } from "../../../src/modules/users/user.model.js";
import { verifyGoogleIdToken } from "../../../src/services/googleAuth.js";
import { API, PASSWORD, lastSentCode, login } from "../../helpers/auth.js";

vi.mock("../../../src/services/email.js", () => ({ sendCodeEmail: vi.fn() }));
vi.mock("../../../src/services/googleAuth.js", () => ({ verifyGoogleIdToken: vi.fn() }));

const EMAIL = "asha@example.com";

let app;
beforeEach(() => {
  app = createApp();
});

const post = (path, body) => request(app).post(`${API}/auth/${path}`).send(body);

// A valid body for every auth endpoint, so the only problem in each request is the one added.
const VALID_BODIES = {
  register: { email: EMAIL, password: PASSWORD },
  "verify-email": { email: EMAIL, code: "123456" },
  "resend-code": { email: EMAIL, purpose: OtpPurpose.VERIFY_EMAIL },
  login: { email: EMAIL, password: PASSWORD },
  google: { idToken: "google-id-token" },
  "forgot-password": { email: EMAIL },
  "reset-password": { email: EMAIL, code: "123456", newPassword: PASSWORD },
  refresh: { refreshToken: "token" },
  logout: { refreshToken: "token" },
};

const expectValidationError = (res) => {
  expect(res.status).toBe(400);
  expect(res.body.code).toBe(ErrorCodes.VALIDATION_ERROR);
};

describe("auth input hardening", () => {
  it.each(Object.keys(VALID_BODIES).filter((path) => "email" in VALID_BODIES[path]))(
    "%s rejects a NoSQL operator as the email",
    async (path) => {
      expectValidationError(await post(path, { ...VALID_BODIES[path], email: { $ne: null } }));
    },
  );

  const massAssignment = Object.keys(VALID_BODIES).flatMap((path) =>
    [{ emailVerified: true }, { isBlocked: false }, { role: "OWNER" }].map((extra) => [
      path,
      Object.keys(extra)[0],
      extra,
    ]),
  );

  it.each(massAssignment)("%s rejects the extra field %s", async (path, _field, extra) => {
    expectValidationError(await post(path, { ...VALID_BODIES[path], ...extra }));
  });

  it("never sends password, Google id, code or token hashes in any response", async () => {
    vi.mocked(verifyGoogleIdToken).mockResolvedValue({
      googleId: "google-sub-secret",
      email: "google@example.com",
      emailVerified: true,
    });
    const responses = [];
    const record = async (pending) => {
      const res = await pending;
      responses.push(JSON.stringify(res.body));
      return res;
    };

    await record(post("register", VALID_BODIES.register));
    await record(post("verify-email", { email: EMAIL, code: lastSentCode() }));
    const signedIn = await record(login(app, EMAIL));
    const refreshed = await record(
      post("refresh", { refreshToken: signedIn.body.data.refreshToken }),
    );
    await record(
      request(app)
        .get(`${API}/me`)
        .set("Authorization", `Bearer ${refreshed.body.data.accessToken}`),
    );
    await record(post("google", VALID_BODIES.google));
    await record(post("forgot-password", { email: EMAIL }));
    await record(post("reset-password", { ...VALID_BODIES["reset-password"], code: "000000" }));

    const users = await User.find().select("+passwordHash +googleId").lean();
    const secrets = [
      "passwordHash",
      "googleId",
      "codeHash",
      "tokenHash",
      "google-sub-secret",
      ...users.map((user) => user.passwordHash).filter(Boolean),
      ...(await OtpCode.find().lean()).map((otp) => otp.codeHash),
      ...(await RefreshToken.find().lean()).map((token) => token.tokenHash),
    ];
    for (const body of responses) {
      for (const secret of secrets) expect(body).not.toContain(secret);
    }
  });

  it.each([
    ["register", "authIp"],
    ["google", "authIp"],
    ["resend-code", "authIp"],
    ["forgot-password", "authIp"],
    ["verify-email", "codeCheck"],
    ["reset-password", "codeCheck"],
  ])("%s is rate-limited per IP (%s)", async (path, limiter) => {
    app = createApp({ rateLimits: { [limiter]: { windowMs: 60_000, limit: 1 } } });
    await post(path, VALID_BODIES[path]);
    const res = await post(path, VALID_BODIES[path]);
    expect(res.status).toBe(429);
    expect(res.body.code).toBe(ErrorCodes.TOO_MANY_REQUESTS);
  });
});
