import { CONSENT_VERSION, ErrorCodes } from "@medstore/shared";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../src/app.js";
import { issueCustomerSession } from "../../../src/modules/auth/session.service.js";
import { User } from "../../../src/modules/users/user.model.js";
import { API, advanceTime, registerAndVerify } from "../../helpers/auth.js";
import { ONBOARDING, onboardedCustomer } from "../../helpers/customer.js";

vi.mock("../../../src/services/email.js", () => ({ sendCodeEmail: vi.fn() }));

const EMAIL = "asha@example.com";
const SECRET = process.env.JWT_CUSTOMER_ACCESS_SECRET;

let app;
beforeEach(() => {
  app = createApp();
});
afterEach(() => {
  vi.useRealTimers();
});

const getMe = (authorization) => {
  const req = request(app).get(`${API}/me`);
  return authorization ? req.set("Authorization", authorization) : req;
};

const sign = (payload, secret = SECRET, options = {}) =>
  `Bearer ${jwt.sign(payload, secret, { algorithm: "HS256", expiresIn: "15m", ...options })}`;

const base64url = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

const expectCode = (res, status, code) => {
  expect(res.status).toBe(status);
  expect(res.body).toMatchObject({ success: false, code });
};

describe("GET /me", () => {
  it("returns the full profile of a new email account", async () => {
    const session = await registerAndVerify(app, EMAIL);
    const res = await getMe(`Bearer ${session.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      message: "Profile loaded",
      data: {
        user: {
          ...session.user,
          isBlocked: false,
          hasPassword: true,
          name: null,
          phone: null,
          dob: null,
          gender: null,
          consentAcceptedAt: null,
          consentVersion: null,
        },
      },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|addressWriteSeq/);
  });

  it("reports hasPassword false for a Google-only account", async () => {
    const user = await User.create({ email: EMAIL, emailVerified: true, googleId: "google-1" });
    const { accessToken } = await issueCustomerSession(user);
    const res = await getMe(`Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ hasPassword: false, isBlocked: false });
  });

  it("returns the onboarded profile", async () => {
    const { api } = await onboardedCustomer(app, EMAIL);
    const res = await api.get("/me");

    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({
      onboardingCompleted: true,
      name: ONBOARDING.name,
      phone: "+919876543210",
      consentVersion: CONSENT_VERSION,
    });
  });

  it("rejects a missing or non-Bearer Authorization header with INVALID_TOKEN", async () => {
    expectCode(await getMe(), 401, ErrorCodes.INVALID_TOKEN);
    expectCode(await getMe("Basic dXNlcjpwYXNz"), 401, ErrorCodes.INVALID_TOKEN);
  });

  it("rejects an expired token with TOKEN_EXPIRED", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const session = await registerAndVerify(app, EMAIL);
    advanceTime(15 * 60 * 1000 + 1000);
    expectCode(await getMe(`Bearer ${session.accessToken}`), 401, ErrorCodes.TOKEN_EXPIRED);
  });

  it("rejects a tampered token with INVALID_TOKEN", async () => {
    const session = await registerAndVerify(app, EMAIL);
    const [header, , signature] = session.accessToken.split(".");
    const forgedPayload = base64url({
      sub: new mongoose.Types.ObjectId().toString(),
      aud: "customer",
      exp: Math.floor(Date.now() / 1000) + 900,
    });
    expectCode(
      await getMe(`Bearer ${header}.${forgedPayload}.${signature}`),
      401,
      ErrorCodes.INVALID_TOKEN,
    );
  });

  it("rejects an alg: none token", async () => {
    const { user } = await registerAndVerify(app, EMAIL);
    const header = base64url({ alg: "none", typ: "JWT" });
    const payload = base64url({
      sub: user.id,
      aud: "customer",
      exp: Math.floor(Date.now() / 1000) + 900,
    });
    expectCode(await getMe(`Bearer ${header}.${payload}.`), 401, ErrorCodes.INVALID_TOKEN);
  });

  it("rejects a token signed with another secret", async () => {
    const { user } = await registerAndVerify(app, EMAIL);
    const token = sign({ sub: user.id, aud: "customer" }, "another-secret-0123456789abcdef0123");
    expectCode(await getMe(token), 401, ErrorCodes.INVALID_TOKEN);
  });

  it("rejects a token with aud: admin", async () => {
    const { user } = await registerAndVerify(app, EMAIL);
    expectCode(await getMe(sign({ sub: user.id, aud: "admin" })), 401, ErrorCodes.INVALID_TOKEN);
  });

  it("rejects a token signed with an algorithm other than HS256", async () => {
    const { user } = await registerAndVerify(app, EMAIL);
    const token = sign({ sub: user.id, aud: "customer" }, SECRET, { algorithm: "HS512" });
    expectCode(await getMe(token), 401, ErrorCodes.INVALID_TOKEN);
  });

  it("rejects a refresh token used as an access token", async () => {
    const session = await registerAndVerify(app, EMAIL);
    expectCode(await getMe(`Bearer ${session.refreshToken}`), 401, ErrorCodes.INVALID_TOKEN);
  });

  it("rejects a valid token whose user was deleted", async () => {
    const session = await registerAndVerify(app, EMAIL);
    await User.deleteMany({});
    expectCode(await getMe(`Bearer ${session.accessToken}`), 401, ErrorCodes.INVALID_TOKEN);
  });

  it("rejects a correctly signed token whose subject is not a user id", async () => {
    expectCode(
      await getMe(sign({ sub: "not-an-id", aud: "customer" })),
      401,
      ErrorCodes.INVALID_TOKEN,
    );
  });
});
