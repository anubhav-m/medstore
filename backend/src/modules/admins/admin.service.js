import { ErrorCodes } from "@medstore/shared";
import { AppError } from "../../utils/AppError.js";
import { hashPassword } from "../../utils/password.js";
import { SubjectKind } from "../auth/refreshToken.model.js";
import { revokeAllSessions } from "../auth/session.service.js";
import { Admin } from "./admin.model.js";

// Admins are a handful of people; the bound only stops a runaway query.
const MAX_LISTED_ADMINS = 1000;

export const accountDisabled = () =>
  new AppError("This account has been disabled", 403, ErrorCodes.ACCOUNT_DISABLED);

export const toAuthAdmin = (admin) => ({
  id: String(admin._id),
  username: admin.username,
  name: admin.name,
  role: admin.role,
  storeIds: admin.storeIds.map(String),
  mustChangePassword: admin.mustChangePassword,
});

// Every new admin must replace the password the owner chose for them at first sign-in.
export const createAdmin = async ({ username, name, password, role }) => {
  const passwordHash = await hashPassword(password);
  try {
    const admin = await Admin.create({
      username,
      name,
      passwordHash,
      role,
      mustChangePassword: true,
    });
    return toAuthAdmin(admin);
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError("This username is already taken", 409, ErrorCodes.DUPLICATE_RESOURCE);
    }
    throw error;
  }
};

// The functions below return null for an unknown username.

export const resetAdminPassword = async (username, password) => {
  const passwordHash = await hashPassword(password);
  const admin = await Admin.findOneAndUpdate(
    { username },
    { $set: { passwordHash, mustChangePassword: true } },
    { returnDocument: "after" },
  ).lean();
  if (!admin) return null;
  await revokeAllSessions(SubjectKind.ADMIN, admin._id);
  return toAuthAdmin(admin);
};

// Access tokens stay signed for up to 15 minutes, but authAdmin reads isActive on every request.
export const disableAdmin = async (username) => {
  const admin = await Admin.findOneAndUpdate(
    { username },
    { $set: { isActive: false } },
    { returnDocument: "after" },
  ).lean();
  if (!admin) return null;
  await revokeAllSessions(SubjectKind.ADMIN, admin._id);
  return toAuthAdmin(admin);
};

export const enableAdmin = async (username) => {
  const admin = await Admin.findOneAndUpdate(
    { username },
    { $set: { isActive: true } },
    { returnDocument: "after" },
  ).lean();
  return admin && toAuthAdmin(admin);
};

export const listAdmins = () =>
  Admin.find({}, { username: 1, name: 1, role: 1, isActive: 1 })
    .sort({ username: 1 })
    .limit(MAX_LISTED_ADMINS)
    .lean();
