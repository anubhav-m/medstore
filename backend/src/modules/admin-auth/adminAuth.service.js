import { ErrorCodes } from "@medstore/shared";
import { AppError, invalidToken } from "../../utils/AppError.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import { Admin } from "../admins/admin.model.js";
import { accountDisabled, toAuthAdmin } from "../admins/admin.service.js";
import { SubjectKind } from "../auth/refreshToken.model.js";
import { issueTokens, revokeAllSessions, rotateRefreshToken } from "../auth/session.service.js";
import { listStoreSummaries } from "../stores/store.service.js";

const invalidCredentials = (message = "Invalid username or password") =>
  new AppError(message, 401, ErrorCodes.INVALID_CREDENTIALS);

const issueAdminSession = async (admin) => ({
  ...(await issueTokens(SubjectKind.ADMIN, admin._id)),
  admin: toAuthAdmin(admin),
});

// Unknown usernames still run an argon2 verify (against a dummy hash), so timing and response
// are identical to a wrong password. Disabled is revealed only after the password matched.
export const login = async ({ username, password }) => {
  const admin = await Admin.findOne({ username }).select("+passwordHash").lean();
  if (!(await verifyPassword(admin?.passwordHash, password))) throw invalidCredentials();
  if (!admin.isActive) throw accountDisabled();

  await Admin.updateOne({ _id: admin._id }, { $set: { lastLoginAt: new Date() } });
  return issueAdminSession(admin);
};

export const refresh = async (token) => {
  const adminId = await rotateRefreshToken(token, SubjectKind.ADMIN);
  const admin = await Admin.findById(adminId).lean();
  if (!admin) throw invalidToken();
  if (!admin.isActive) throw accountDisabled();
  return issueAdminSession(admin);
};

// The update matches the hash that was verified, so a password reset by script in between
// isn't overwritten. Every session is revoked; the caller gets a fresh pair.
export const changePassword = async (adminId, { currentPassword, newPassword }) => {
  const admin = await Admin.findById(adminId).select("+passwordHash").lean();
  if (!(await verifyPassword(admin?.passwordHash, currentPassword))) {
    throw invalidCredentials("Your current password is incorrect");
  }

  const updated = await Admin.findOneAndUpdate(
    { _id: adminId, passwordHash: admin.passwordHash, isActive: true },
    { $set: { passwordHash: await hashPassword(newPassword), mustChangePassword: false } },
    { returnDocument: "after" },
  ).lean();
  if (!updated) {
    const current = await Admin.findById(adminId, { isActive: 1 }).lean();
    if (current && !current.isActive) throw accountDisabled();
    throw invalidCredentials("Your current password is incorrect");
  }

  await revokeAllSessions(SubjectKind.ADMIN, adminId);
  return issueAdminSession(updated);
};

export const getMe = async (adminId) => {
  const admin = await Admin.findById(adminId).lean();
  if (!admin) throw invalidToken();
  return { admin: toAuthAdmin(admin), stores: await listStoreSummaries(admin) };
};
