import { ErrorCodes, OtpPurpose } from "@medstore/shared";
import { AppError } from "../../utils/AppError.js";
import { hashPassword } from "../../utils/password.js";
import { User } from "../users/user.model.js";
import { SubjectKind } from "./refreshToken.model.js";
import { consumeCode } from "./otp.service.js";
import { revokeAllSessions } from "./session.service.js";

// Also how Google-only accounts add a password. A correct code proves inbox access, so the
// email becomes verified.
export const resetPassword = async ({ email, code, newPassword }) => {
  const user = await User.findOne({ email }).lean();
  if (!user) {
    throw new AppError(
      "The code is invalid or has expired",
      400,
      ErrorCodes.INVALID_OR_EXPIRED_CODE,
    );
  }
  await consumeCode(user._id, OtpPurpose.RESET_PASSWORD, code);
  const passwordHash = await hashPassword(newPassword);
  await User.updateOne({ _id: user._id }, { $set: { passwordHash, emailVerified: true } });
  await revokeAllSessions(SubjectKind.CUSTOMER, user._id);
};
