import { AdminRole, ErrorCodes } from "@medstore/shared";
import { describe, expect, it } from "vitest";
import { Admin } from "../../../src/modules/admins/admin.model.js";
import {
  createAdmin,
  disableAdmin,
  enableAdmin,
  listAdmins,
  resetAdminPassword,
} from "../../../src/modules/admins/admin.service.js";
import { RefreshToken, SubjectKind } from "../../../src/modules/auth/refreshToken.model.js";
import { issueTokens } from "../../../src/modules/auth/session.service.js";
import { verifyPassword } from "../../../src/utils/password.js";
import { ADMIN_PASSWORD, ADMIN_USERNAME, createTestAdmin } from "../../helpers/admin.js";

const NEW_PASSWORD = "a reset password";

const storedAdmin = () =>
  Admin.findOne({ username: ADMIN_USERNAME }).select("+passwordHash").lean();

const activeSessionCount = () => RefreshToken.countDocuments({ revokedAt: null });

describe("createAdmin", () => {
  it("creates an owner who must change the argon2-hashed password", async () => {
    const admin = await createAdmin({
      username: ADMIN_USERNAME,
      name: "Owner One",
      password: ADMIN_PASSWORD,
      role: AdminRole.OWNER,
    });

    expect(admin).toEqual({
      id: expect.any(String),
      username: ADMIN_USERNAME,
      name: "Owner One",
      role: AdminRole.OWNER,
      storeIds: [],
      mustChangePassword: true,
    });
    const stored = await storedAdmin();
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(stored.passwordHash, ADMIN_PASSWORD)).toBe(true);
    expect(stored).toMatchObject({ isActive: true, lastLoginAt: null });
  });

  it("refuses a username that is already taken, in any letter case", async () => {
    await createTestAdmin();
    await expect(
      createAdmin({
        username: "OWNER.ONE",
        name: "Someone Else",
        password: ADMIN_PASSWORD,
        role: AdminRole.OWNER,
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: ErrorCodes.DUPLICATE_RESOURCE });
    expect(await Admin.countDocuments()).toBe(1);
  });
});

describe("resetAdminPassword", () => {
  it("replaces the password, requires a change and revokes every session", async () => {
    const admin = await createTestAdmin();
    await issueTokens(SubjectKind.ADMIN, admin.id);
    await issueTokens(SubjectKind.ADMIN, admin.id);

    const result = await resetAdminPassword(ADMIN_USERNAME, NEW_PASSWORD);

    expect(result).toMatchObject({ username: ADMIN_USERNAME, mustChangePassword: true });
    const stored = await storedAdmin();
    expect(await verifyPassword(stored.passwordHash, NEW_PASSWORD)).toBe(true);
    expect(await verifyPassword(stored.passwordHash, ADMIN_PASSWORD)).toBe(false);
    expect(await activeSessionCount()).toBe(0);
  });

  it("returns null for an unknown username", async () => {
    expect(await resetAdminPassword("nobody", NEW_PASSWORD)).toBeNull();
  });
});

describe("disableAdmin / enableAdmin", () => {
  it("disables the admin and revokes every session", async () => {
    const admin = await createTestAdmin();
    await issueTokens(SubjectKind.ADMIN, admin.id);

    expect(await disableAdmin(ADMIN_USERNAME)).toMatchObject({ username: ADMIN_USERNAME });
    expect((await storedAdmin()).isActive).toBe(false);
    expect(await activeSessionCount()).toBe(0);
  });

  it("leaves customer sessions with the same id alone", async () => {
    const admin = await createTestAdmin();
    await issueTokens(SubjectKind.CUSTOMER, admin.id);
    await disableAdmin(ADMIN_USERNAME);
    expect(await activeSessionCount()).toBe(1);
  });

  it("enables a disabled admin", async () => {
    await createTestAdmin({ isActive: false });
    expect(await enableAdmin(ADMIN_USERNAME)).toMatchObject({ username: ADMIN_USERNAME });
    expect((await storedAdmin()).isActive).toBe(true);
  });

  it("returns null for an unknown username", async () => {
    expect(await disableAdmin("nobody")).toBeNull();
    expect(await enableAdmin("nobody")).toBeNull();
  });
});

describe("listAdmins", () => {
  it("lists admins by username without password hashes", async () => {
    await createTestAdmin({ username: "zara" });
    await createTestAdmin({ username: "amit", isActive: false });

    const admins = await listAdmins();
    expect(admins.map(({ username, isActive }) => ({ username, isActive }))).toEqual([
      { username: "amit", isActive: false },
      { username: "zara", isActive: true },
    ]);
    for (const admin of admins) expect(admin).not.toHaveProperty("passwordHash");
  });
});
