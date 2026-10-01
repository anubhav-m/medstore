import { AdminRole } from "@medstore/shared";
import request from "supertest";
import { expect } from "vitest";
import { Admin } from "../../src/modules/admins/admin.model.js";
import { createAdmin } from "../../src/modules/admins/admin.service.js";

export const ADMIN_API = "/api/v1/admin";
export const ADMIN_USERNAME = "owner.one";
export const ADMIN_PASSWORD = "a long admin password";

// Created through the service like the scripts do; the flags are then set directly so each
// test starts from the state it needs.
export const createTestAdmin = async ({
  username = ADMIN_USERNAME,
  name = "Owner One",
  password = ADMIN_PASSWORD,
  mustChangePassword = false,
  isActive = true,
  role = AdminRole.OWNER,
  storeCodes = [],
} = {}) => {
  const admin = await createAdmin({ username, name, password, role, storeCodes });
  await Admin.updateOne({ _id: admin.id }, { $set: { mustChangePassword, isActive } });
  return { ...admin, mustChangePassword };
};

export const adminLogin = (app, username = ADMIN_USERNAME, password = ADMIN_PASSWORD) =>
  request(app).post(`${ADMIN_API}/auth/login`).send({ username, password });

export const signInAdmin = async (app, options) => {
  await createTestAdmin(options);
  const res = await adminLogin(app, options?.username, options?.password);
  expect(res.status).toBe(200);
  return res.body.data;
};

// Requests as the admin holding `token`, e.g. api.get("/stores").
export const adminApi = (app, token) => {
  const call = (method) => (path) =>
    request(app)[method](`${ADMIN_API}${path}`).set("Authorization", `Bearer ${token}`);
  return { get: call("get"), post: call("post"), patch: call("patch"), delete: call("delete") };
};

export const adminRefresh = (app, refreshToken) =>
  request(app).post(`${ADMIN_API}/auth/refresh`).send({ refreshToken });

export const adminLogout = (app, refreshToken) =>
  request(app).post(`${ADMIN_API}/auth/logout`).send({ refreshToken });

export const getAdminMe = (app, accessToken) =>
  request(app).get(`${ADMIN_API}/me`).set("Authorization", `Bearer ${accessToken}`);

export const expectError = (res, status, code) => {
  expect(res.status).toBe(status);
  expect(res.body).toMatchObject({ success: false, code });
};
