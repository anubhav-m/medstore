import { AdminRole, ErrorCodes, MAX_PUSH_TOKENS_PER_ACCOUNT } from "@medstore/shared";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../src/app.js";
import { Admin } from "../../../src/modules/admins/admin.model.js";
import { disableAdmin, resetAdminPassword } from "../../../src/modules/admins/admin.service.js";
import { User } from "../../../src/modules/users/user.model.js";
import {
  ADMIN_API,
  ADMIN_PASSWORD,
  adminApi,
  adminLogin,
  createTestAdmin,
  expectError,
  signInAdmin,
} from "../../helpers/admin.js";
import { API, PASSWORD, lastSentCode, registerAndVerify } from "../../helpers/auth.js";
import { pushToken, storedTokens } from "../../helpers/push.js";
import { createTestStore } from "../../helpers/store.js";

vi.mock("../../../src/services/email.js", () => ({ sendCodeEmail: vi.fn() }));

let app;
beforeEach(() => {
  app = createApp();
});

const asCustomer = (accessToken) => ({
  register: (body) =>
    request(app)
      .post(`${API}/me/push-tokens`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send(body),
  remove: (body) =>
    request(app)
      .delete(`${API}/me/push-tokens`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send(body),
});

// Signed up but not onboarded: push tokens don't need onboarding.
const signUp = async (email) => {
  const session = await registerAndVerify(app, email);
  return { ...session, ...asCustomer(session.accessToken), filter: { email } };
};

const customerTokens = (customer) => storedTokens(User, customer.filter);
const adminTokens = (username) => storedTokens(Admin, { username });

const customerLogout = (body) => request(app).post(`${API}/auth/logout`).send(body);
const adminLogout = (body) => request(app).post(`${ADMIN_API}/auth/logout`).send(body);

describe("POST /me/push-tokens", () => {
  it("stores the token on the customer without needing onboarding", async () => {
    const asha = await signUp("asha@example.com");

    const res = await asha.register({ token: pushToken(1) });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: "Notifications turned on" });
    const user = await User.findOne(asha.filter).lean();
    expect(user.pushTokens).toEqual([{ token: pushToken(1), createdAt: expect.any(Date) }]);
  });

  it.each([
    ["not an Expo token", { token: "not-a-token" }],
    ["empty", { token: "" }],
    ["too long", { token: `ExponentPushToken[${"x".repeat(200)}]` }],
    ["not a string", { token: 42 }],
    ["missing", {}],
  ])("rejects a token that is %s", async (_label, body) => {
    const asha = await signUp("asha@example.com");
    const res = await asha.register(body);
    expectError(res, 400, ErrorCodes.VALIDATION_ERROR);
    expect(res.body.errors.map((error) => error.field)).toEqual(["token"]);
    expect(await customerTokens(asha)).toEqual([]);
  });

  it("rejects unknown fields", async () => {
    const asha = await signUp("asha@example.com");
    const res = await asha.register({ token: pushToken(1), userId: "someone-else" });
    expectError(res, 400, ErrorCodes.VALIDATION_ERROR);
    expect(res.body.errors.map((error) => error.field)).toEqual(["userId"]);
  });

  it("keeps one entry per token and makes a re-registered token the newest", async () => {
    const asha = await signUp("asha@example.com");
    for (const n of [1, 2, 1]) await asha.register({ token: pushToken(n) }).expect(200);
    expect(await customerTokens(asha)).toEqual([pushToken(2), pushToken(1)]);
  });

  it(`keeps the newest ${MAX_PUSH_TOKENS_PER_ACCOUNT} tokens, dropping the oldest`, async () => {
    const asha = await signUp("asha@example.com");
    for (let n = 1; n <= MAX_PUSH_TOKENS_PER_ACCOUNT + 1; n += 1) {
      await asha.register({ token: pushToken(n) }).expect(200);
    }
    const expected = Array.from({ length: MAX_PUSH_TOKENS_PER_ACCOUNT }, (_, i) =>
      pushToken(i + 2),
    );
    expect(await customerTokens(asha)).toEqual(expected);
  });

  it("moves the token off every other customer and admin", async () => {
    const asha = await signUp("asha@example.com");
    const ravi = await signUp("ravi@example.com");
    await createTestAdmin();
    await asha.register({ token: pushToken(9) }).expect(200);
    await ravi.register({ token: pushToken(1) }).expect(200);
    await Admin.updateOne(
      {},
      { $set: { pushTokens: [{ token: pushToken(1), createdAt: new Date() }] } },
    );

    await asha.register({ token: pushToken(1) }).expect(200);

    expect(await customerTokens(asha)).toEqual([pushToken(9), pushToken(1)]);
    expect(await customerTokens(ravi)).toEqual([]);
    expect(await adminTokens("owner.one")).toEqual([]);
  });

  it("requires a customer access token", async () => {
    const { accessToken } = await signInAdmin(app);
    expectError(
      await request(app)
        .post(`${API}/me/push-tokens`)
        .send({ token: pushToken(1) }),
      401,
      ErrorCodes.INVALID_TOKEN,
    );
    expectError(
      await asCustomer(accessToken).register({ token: pushToken(1) }),
      401,
      ErrorCodes.INVALID_TOKEN,
    );
  });

  it("never returns push tokens from GET /me", async () => {
    const asha = await signUp("asha@example.com");
    await asha.register({ token: pushToken(1) }).expect(200);
    const res = await request(app)
      .get(`${API}/me`)
      .set("Authorization", `Bearer ${asha.accessToken}`);
    expect(JSON.stringify(res.body)).not.toContain(pushToken(1));
  });
});

describe("DELETE /me/push-tokens", () => {
  it("removes the token from the caller's account", async () => {
    const asha = await signUp("asha@example.com");
    for (const n of [1, 2]) await asha.register({ token: pushToken(n) }).expect(200);

    const res = await asha.remove({ token: pushToken(1) });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: "Notifications turned off" });
    expect(await customerTokens(asha)).toEqual([pushToken(2)]);
  });

  it("can't remove another account's token", async () => {
    const asha = await signUp("asha@example.com");
    const ravi = await signUp("ravi@example.com");
    await ravi.register({ token: pushToken(1) }).expect(200);

    await asha.remove({ token: pushToken(1) }).expect(200);

    expect(await customerTokens(ravi)).toEqual([pushToken(1)]);
  });

  it("rejects an invalid token and a missing access token", async () => {
    const asha = await signUp("asha@example.com");
    expectError(await asha.remove({ token: "nope" }), 400, ErrorCodes.VALIDATION_ERROR);
    expectError(
      await request(app)
        .delete(`${API}/me/push-tokens`)
        .send({ token: pushToken(1) }),
      401,
      ErrorCodes.INVALID_TOKEN,
    );
  });
});

describe("admin push tokens", () => {
  const signIn = async (options) => adminApi(app, (await signInAdmin(app, options)).accessToken);

  it("registers and removes a token on the admin", async () => {
    const owner = await signIn();

    await owner
      .post("/me/push-tokens")
      .send({ token: pushToken(1) })
      .expect(200);
    await owner
      .post("/me/push-tokens")
      .send({ token: pushToken(2) })
      .expect(200);
    expect(await adminTokens("owner.one")).toEqual([pushToken(1), pushToken(2)]);

    const res = await owner.delete("/me/push-tokens").send({ token: pushToken(1) });
    expect(res.status).toBe(200);
    expect(await adminTokens("owner.one")).toEqual([pushToken(2)]);
  });

  it("moves the token off customers and other admins", async () => {
    const asha = await signUp("asha@example.com");
    await asha.register({ token: pushToken(1) }).expect(200);
    const other = await signIn({ username: "owner.two" });
    await other
      .post("/me/push-tokens")
      .send({ token: pushToken(1) })
      .expect(200);
    expect(await customerTokens(asha)).toEqual([]);

    const owner = await signIn();
    await owner
      .post("/me/push-tokens")
      .send({ token: pushToken(1) })
      .expect(200);

    expect(await adminTokens("owner.one")).toEqual([pushToken(1)]);
    expect(await adminTokens("owner.two")).toEqual([]);
  });

  it(`keeps the admin's newest ${MAX_PUSH_TOKENS_PER_ACCOUNT} tokens`, async () => {
    const owner = await signIn();
    for (let n = 1; n <= MAX_PUSH_TOKENS_PER_ACCOUNT + 1; n += 1) {
      await owner
        .post("/me/push-tokens")
        .send({ token: pushToken(n) })
        .expect(200);
    }
    const tokens = await adminTokens("owner.one");
    expect(tokens).toHaveLength(MAX_PUSH_TOKENS_PER_ACCOUNT);
    expect(tokens[0]).toBe(pushToken(2));
  });

  it("rejects an invalid token and can't remove another admin's token", async () => {
    const owner = await signIn();
    const store = await createTestStore();
    const staff = await signIn({
      username: "staff.one",
      role: AdminRole.STAFF,
      storeCodes: [store.code],
    });
    await staff
      .post("/me/push-tokens")
      .send({ token: pushToken(99) })
      .expect(200);

    expectError(
      await owner.post("/me/push-tokens").send({ token: "nope" }),
      400,
      ErrorCodes.VALIDATION_ERROR,
    );
    await owner
      .delete("/me/push-tokens")
      .send({ token: pushToken(99) })
      .expect(200);
    expect(await adminTokens("staff.one")).toEqual([pushToken(99)]);
  });

  it("requires an admin who has changed the initial password", async () => {
    const { accessToken } = await signInAdmin(app, { mustChangePassword: true });
    expectError(
      await adminApi(app, accessToken)
        .post("/me/push-tokens")
        .send({ token: pushToken(1) }),
      403,
      ErrorCodes.PASSWORD_CHANGE_REQUIRED,
    );
  });

  it("rejects a customer access token", async () => {
    const asha = await signUp("asha@example.com");
    expectError(
      await adminApi(app, asha.accessToken)
        .post("/me/push-tokens")
        .send({ token: pushToken(1) }),
      401,
      ErrorCodes.INVALID_TOKEN,
    );
  });
});

describe("logout with a push token", () => {
  it("removes the device's token from the customer and keeps the others", async () => {
    const asha = await signUp("asha@example.com");
    for (const n of [1, 2]) await asha.register({ token: pushToken(n) }).expect(200);

    await customerLogout({ refreshToken: asha.refreshToken, pushToken: pushToken(1) }).expect(200);

    expect(await customerTokens(asha)).toEqual([pushToken(2)]);
  });

  it("still removes it when the session was already revoked", async () => {
    const asha = await signUp("asha@example.com");
    await asha.register({ token: pushToken(1) }).expect(200);
    await customerLogout({ refreshToken: asha.refreshToken }).expect(200);
    expect(await customerTokens(asha)).toEqual([pushToken(1)]);

    await customerLogout({ refreshToken: asha.refreshToken, pushToken: pushToken(1) }).expect(200);

    expect(await customerTokens(asha)).toEqual([]);
  });

  it("never removes another account's token", async () => {
    const asha = await signUp("asha@example.com");
    const ravi = await signUp("ravi@example.com");
    await ravi.register({ token: pushToken(1) }).expect(200);

    await customerLogout({ refreshToken: "never-issued", pushToken: pushToken(1) }).expect(200);
    await customerLogout({ refreshToken: asha.refreshToken, pushToken: pushToken(1) }).expect(200);

    expect(await customerTokens(ravi)).toEqual([pushToken(1)]);
  });

  it("rejects an invalid push token", async () => {
    const asha = await signUp("asha@example.com");
    const res = await customerLogout({ refreshToken: asha.refreshToken, pushToken: "nope" });
    expectError(res, 400, ErrorCodes.VALIDATION_ERROR);
    expect(res.body.errors.map((error) => error.field)).toEqual(["pushToken"]);
  });

  it("removes the device's token from the admin, never from a customer", async () => {
    const asha = await signUp("asha@example.com");
    await asha.register({ token: pushToken(2) }).expect(200);
    const { refreshToken, accessToken } = await signInAdmin(app);
    const owner = adminApi(app, accessToken);
    await owner
      .post("/me/push-tokens")
      .send({ token: pushToken(1) })
      .expect(200);

    await adminLogout({ refreshToken, pushToken: pushToken(2) }).expect(200);
    await adminLogout({ refreshToken, pushToken: pushToken(1) }).expect(200);

    expect(await adminTokens("owner.one")).toEqual([]);
    expect(await customerTokens(asha)).toEqual([pushToken(2)]);
    expectError(
      await adminLogout({ refreshToken, pushToken: "nope" }),
      400,
      ErrorCodes.VALIDATION_ERROR,
    );
  });
});

describe("revoking every session", () => {
  it("clears the customer's push tokens on password reset", async () => {
    const asha = await signUp("asha@example.com");
    await asha.register({ token: pushToken(1) }).expect(200);

    await request(app)
      .post(`${API}/auth/forgot-password`)
      .send({ email: "asha@example.com" })
      .expect(200);
    await request(app)
      .post(`${API}/auth/reset-password`)
      .send({
        email: "asha@example.com",
        code: lastSentCode("RESET_PASSWORD"),
        newPassword: `${PASSWORD} 2`,
      })
      .expect(200);

    expect(await customerTokens(asha)).toEqual([]);
  });

  it("clears the customer's push tokens when a rotated refresh token is reused", async () => {
    const asha = await signUp("asha@example.com");
    await asha.register({ token: pushToken(1) }).expect(200);
    const refresh = (refreshToken) =>
      request(app).post(`${API}/auth/refresh`).send({ refreshToken });
    await refresh(asha.refreshToken).expect(200);

    expectError(await refresh(asha.refreshToken), 401, ErrorCodes.INVALID_TOKEN);

    expect(await customerTokens(asha)).toEqual([]);
  });

  it("clears the admin's push tokens on password change, reset and disable", async () => {
    const register = async () => {
      const { accessToken } = (await adminLogin(app)).body.data;
      await adminApi(app, accessToken)
        .post("/me/push-tokens")
        .send({ token: pushToken(1) })
        .expect(200);
      return adminApi(app, accessToken);
    };
    await createTestAdmin();

    const owner = await register();
    await owner
      .post("/auth/change-password")
      .send({ currentPassword: ADMIN_PASSWORD, newPassword: `${ADMIN_PASSWORD} 2` })
      .expect(200);
    expect(await adminTokens("owner.one")).toEqual([]);

    await resetAdminPassword("owner.one", ADMIN_PASSWORD);
    await Admin.updateOne({ username: "owner.one" }, { $set: { mustChangePassword: false } });
    await register();
    await resetAdminPassword("owner.one", ADMIN_PASSWORD);
    expect(await adminTokens("owner.one")).toEqual([]);

    await Admin.updateOne({ username: "owner.one" }, { $set: { mustChangePassword: false } });
    await register();
    await disableAdmin("owner.one");
    expect(await adminTokens("owner.one")).toEqual([]);
  });
});
