import { ErrorCodes } from "@medstore/shared";
import { AppError, invalidToken } from "../../utils/AppError.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import { SubjectKind } from "../auth/refreshToken.model.js";
import { issueCustomerSession, revokeAllSessions } from "../auth/session.service.js";
import { User } from "./user.model.js";

const wrongCurrentPassword = () =>
  new AppError("Your current password is incorrect", 401, ErrorCodes.INVALID_CREDENTIALS);

// An account without a password is verified against the dummy hash and fails (it adds one through
// forgot-password). The update matches the hash that was verified, so a reset in between isn't
// overwritten. Every session is revoked (root 3.2); the caller gets a fresh pair.
export const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await User.findById(userId).select("+passwordHash").lean();
  if (!user) throw invalidToken();
  if (!(await verifyPassword(user.passwordHash, currentPassword))) throw wrongCurrentPassword();

  const updated = await User.findOneAndUpdate(
    { _id: userId, passwordHash: user.passwordHash },
    { $set: { passwordHash: await hashPassword(newPassword) } },
    { returnDocument: "after" },
  ).lean();
  if (!updated) {
    if (!(await User.exists({ _id: userId }))) throw invalidToken();
    throw wrongCurrentPassword();
  }

  await revokeAllSessions(SubjectKind.CUSTOMER, userId);
  return issueCustomerSession(updated);
};
