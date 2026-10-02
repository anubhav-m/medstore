import {
  ErrorCodes,
  OPEN_ORDER_STATUSES,
  OrderAction,
  OrderStatus,
  OtpPurpose,
  TERMINAL_ORDER_STATUSES,
} from "@medstore/shared";
import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../src/app.js";
import { Address } from "../../../src/modules/addresses/address.model.js";
import { OtpCode } from "../../../src/modules/auth/otpCode.model.js";
import { RefreshToken } from "../../../src/modules/auth/refreshToken.model.js";
import { Order } from "../../../src/modules/orders/order.model.js";
import { User } from "../../../src/modules/users/user.model.js";
import { verifyGoogleIdToken } from "../../../src/services/googleAuth.js";
import { AppError } from "../../../src/utils/AppError.js";
import { expectError } from "../../helpers/admin.js";
import { runAction, seedStoreOrder } from "../../helpers/adminOrder.js";
import {
  API,
  PASSWORD,
  advanceTime,
  lastSentCode,
  login,
  registerAndVerify,
} from "../../helpers/auth.js";
import { ADDRESS, ONBOARDING } from "../../helpers/customer.js";
import { NOW, ensureOrderIndexes, mockStorageOk } from "../../helpers/order.js";
import { pushToken } from "../../helpers/push.js";
import { createTestStore, signInOwner } from "../../helpers/store.js";

vi.mock("../../../src/services/email.js", () => ({ sendCodeEmail: vi.fn() }));
vi.mock("../../../src/services/googleAuth.js", () => ({ verifyGoogleIdToken: vi.fn() }));
vi.mock("../../../src/services/storage.js", () => ({
  verifyImageObject: vi.fn(),
  createSignedViewUrls: vi.fn(),
}));

const EMAIL = "asha@example.com";
const GOOGLE_ID = "google-sub-123";

let app;
beforeAll(ensureOrderIndexes);
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  mockStorageOk();
  app = createApp();
});
afterEach(() => {
  vi.useRealTimers();
});

const as = (accessToken) => (method, path) =>
  request(app)[method](`${API}${path}`).set("Authorization", `Bearer ${accessToken}`);

const deleteAccount = (accessToken, body) => as(accessToken)("delete", "/me").send(body);

// An onboarded email customer, plus its session and a second address.
const onboardedSession = async () => {
  const session = await registerAndVerify(app, EMAIL);
  const call = as(session.accessToken);
  await call("post", "/me/onboarding").send(ONBOARDING).expect(200);
  await call("post", "/addresses")
    .send({ ...ADDRESS, label: "Work" })
    .expect(200);
  return { ...session, customer: { user: session.user } };
};

const googleOnlySession = async () => {
  vi.mocked(verifyGoogleIdToken).mockResolvedValueOnce({
    googleId: GOOGLE_ID,
    email: EMAIL,
    emailVerified: true,
  });
  const res = await request(app).post(`${API}/auth/google`).send({ idToken: "sign-in-token" });
  expect(res.status).toBe(200);
  return res.body.data;
};

const googleConfirms = (googleId) =>
  vi
    .mocked(verifyGoogleIdToken)
    .mockResolvedValueOnce({ googleId, email: EMAIL, emailVerified: true });

const accountExists = async (userId) => Boolean(await User.exists({ _id: userId }));

describe("DELETE /me", () => {
  it("deletes the account, its addresses, sessions, push tokens and codes", async () => {
    const session = await onboardedSession();
    const userId = session.user.id;
    const call = as(session.accessToken);
    await call("post", "/me/push-tokens")
      .send({ token: pushToken(1) })
      .expect(200);
    await request(app).post(`${API}/auth/forgot-password`).send({ email: EMAIL }).expect(200);
    expect(await OtpCode.countDocuments({ userId, purpose: OtpPurpose.RESET_PASSWORD })).toBe(1);

    const res = await deleteAccount(session.accessToken, { password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: "Account deleted" });
    expect(await accountExists(userId)).toBe(false);
    expect(await Address.countDocuments({ userId })).toBe(0);
    expect(await RefreshToken.countDocuments({ subjectId: userId })).toBe(0);
    expect(await OtpCode.countDocuments({ userId })).toBe(0);
    expect(await User.countDocuments({ "pushTokens.token": pushToken(1) })).toBe(0);
  });

  it("works before onboarding", async () => {
    const session = await registerAndVerify(app, EMAIL);

    const res = await deleteAccount(session.accessToken, { password: PASSWORD });

    expect(res.status).toBe(200);
    expect(await accountExists(session.user.id)).toBe(false);
  });

  it("signs the account out everywhere and frees the email to register again", async () => {
    const session = await onboardedSession();
    await deleteAccount(session.accessToken, { password: PASSWORD }).expect(200);

    expectError(await login(app, EMAIL), 401, ErrorCodes.INVALID_CREDENTIALS);
    expectError(
      await request(app).post(`${API}/auth/refresh`).send({ refreshToken: session.refreshToken }),
      401,
      ErrorCodes.INVALID_TOKEN,
    );
    expectError(await as(session.accessToken)("get", "/me"), 401, ErrorCodes.INVALID_TOKEN);

    // The per-email code-send limits still apply to the freed email.
    advanceTime(61_000);
    const again = await registerAndVerify(app, EMAIL);
    expect(again.user.id).not.toBe(session.user.id);
    const me = await as(again.accessToken)("get", "/me");
    expect(me.body.data.user).toMatchObject({ email: EMAIL, onboardingCompleted: false });
  });

  it("keeps past orders and their photos, and staff see the customer as deleted", async () => {
    const session = await onboardedSession();
    const store = await createTestStore();
    const order = await seedStoreOrder(session.customer, store, OrderStatus.DELIVERED);
    const owner = await signInOwner(app);

    await deleteAccount(session.accessToken, { password: PASSWORD }).expect(200);

    expect(await Order.findById(order._id).lean()).toEqual(order);
    const res = await owner.get(`/orders/${order._id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.order.customer).toEqual({
      id: session.user.id,
      name: "Asha Rao",
      phone: "+919876543210",
      isDeleted: true,
    });
    expect(res.body.data.order.imageUrls).toHaveLength(1);
    expectError(
      await owner.patch(`/customers/${session.user.id}/block`).send({ isBlocked: true }),
      404,
      ErrorCodes.CUSTOMER_NOT_FOUND,
    );
  });

  it.each(OPEN_ORDER_STATUSES)(
    "refuses with ACCOUNT_HAS_OPEN_ORDERS while an order is %s",
    async (status) => {
      const session = await onboardedSession();
      const store = await createTestStore();
      await seedStoreOrder(session.customer, store, status);

      const res = await deleteAccount(session.accessToken, { password: PASSWORD });

      expectError(res, 409, ErrorCodes.ACCOUNT_HAS_OPEN_ORDERS);
      expect(await accountExists(session.user.id)).toBe(true);
      expect(await Address.countDocuments({ userId: session.user.id })).toBe(2);
      await as(session.accessToken)("get", "/me").expect(200);
    },
  );

  it.each(TERMINAL_ORDER_STATUSES)("allows deletion with a %s order", async (status) => {
    const session = await onboardedSession();
    const store = await createTestStore();
    await seedStoreOrder(session.customer, store, status);

    await deleteAccount(session.accessToken, { password: PASSWORD }).expect(200);
  });

  it("allows deletion once the open order is delivered", async () => {
    const session = await onboardedSession();
    const store = await createTestStore();
    const order = await seedStoreOrder(session.customer, store, OrderStatus.OUT_FOR_DELIVERY);
    const owner = await signInOwner(app);
    const first = await deleteAccount(session.accessToken, { password: PASSWORD });
    expectError(first, 409, ErrorCodes.ACCOUNT_HAS_OPEN_ORDERS);

    await runAction(owner, order._id, OrderAction.DELIVER).expect(200);

    await deleteAccount(session.accessToken, { password: PASSWORD }).expect(200);
  });

  it("rejects a wrong password and deletes nothing", async () => {
    const session = await onboardedSession();

    const res = await deleteAccount(session.accessToken, { password: "not the password" });

    expectError(res, 401, ErrorCodes.INVALID_CREDENTIALS);
    expect(await accountExists(session.user.id)).toBe(true);
    expect(await Address.countDocuments({ userId: session.user.id })).toBe(2);
    expect((await login(app, EMAIL)).status).toBe(200);
  });

  it("requires the password, not Google, for an account with a password", async () => {
    const session = await onboardedSession();

    const res = await deleteAccount(session.accessToken, { googleIdToken: "google-token" });

    expectError(res, 401, ErrorCodes.INVALID_CREDENTIALS);
    expect(verifyGoogleIdToken).not.toHaveBeenCalled();
    expect(await accountExists(session.user.id)).toBe(true);
  });

  it("deletes a Google-only account with a token for its Google account", async () => {
    const session = await googleOnlySession();
    googleConfirms(GOOGLE_ID);

    const res = await deleteAccount(session.accessToken, { googleIdToken: "fresh-token" });

    expect(res.status).toBe(200);
    expect(verifyGoogleIdToken).toHaveBeenLastCalledWith("fresh-token");
    expect(await accountExists(session.user.id)).toBe(false);
  });

  it("rejects a token for another Google account, a bad token or a password", async () => {
    const session = await googleOnlySession();

    googleConfirms("another-google-account");
    const other = await deleteAccount(session.accessToken, { googleIdToken: "other-token" });
    expectError(other, 401, ErrorCodes.INVALID_CREDENTIALS);

    vi.mocked(verifyGoogleIdToken).mockRejectedValueOnce(
      new AppError("Google sign-in failed", 401, ErrorCodes.INVALID_CREDENTIALS),
    );
    const bad = await deleteAccount(session.accessToken, { googleIdToken: "bad-token" });
    expectError(bad, 401, ErrorCodes.INVALID_CREDENTIALS);

    const password = await deleteAccount(session.accessToken, { password: PASSWORD });
    expectError(password, 401, ErrorCodes.INVALID_CREDENTIALS);

    expect(await accountExists(session.user.id)).toBe(true);
  });

  it.each([
    ["neither credential", {}],
    ["both credentials", { password: PASSWORD, googleIdToken: "google-token" }],
    ["an emailed code instead", { code: "123456" }],
    ["an operator instead of a password", { password: { $ne: null } }],
  ])("rejects %s with VALIDATION_ERROR and deletes nothing", async (_case, body) => {
    const session = await registerAndVerify(app, EMAIL);

    expectError(await deleteAccount(session.accessToken, body), 400, ErrorCodes.VALIDATION_ERROR);
    expect(await accountExists(session.user.id)).toBe(true);
  });

  it("can't be used with a verification or reset code", async () => {
    const session = await registerAndVerify(app, EMAIL);
    advanceTime(61_000);
    await request(app).post(`${API}/auth/forgot-password`).send({ email: EMAIL }).expect(200);
    const code = lastSentCode(OtpPurpose.RESET_PASSWORD);

    const res = await deleteAccount(session.accessToken, { password: code });

    expectError(res, 401, ErrorCodes.INVALID_CREDENTIALS);
    expect(await accountExists(session.user.id)).toBe(true);
    expect(await OtpCode.countDocuments({ userId: session.user.id })).toBe(1);
  });

  it("requires an access token", async () => {
    const res = await request(app).delete(`${API}/me`).send({ password: PASSWORD });

    expectError(res, 401, ErrorCodes.INVALID_TOKEN);
  });

  it("limits re-authentication attempts per customer", async () => {
    app = createApp({ rateLimits: { customerReauth: { windowMs: 60_000, limit: 2 } } });
    const session = await registerAndVerify(app, EMAIL);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const res = await deleteAccount(session.accessToken, { password: "wrong password" });
      expectError(res, 401, ErrorCodes.INVALID_CREDENTIALS);
    }
    const blocked = await deleteAccount(session.accessToken, { password: PASSWORD });

    expectError(blocked, 429, ErrorCodes.TOO_MANY_REQUESTS);
    expect(await accountExists(session.user.id)).toBe(true);
  });
});
