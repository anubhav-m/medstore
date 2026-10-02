import { ErrorCodes, OtpPurpose } from "@medstore/shared";
import { AppError } from "../../utils/AppError.js";
import { hashPassword } from "../../utils/password.js";
import { User } from "../users/user.model.js";
import { consumeCode, issueAndSendCode, releaseCodeSend, reserveCodeSend } from "./otp.service.js";
import { issueCustomerSession } from "./session.service.js";

const alreadyRegistered = () =>
  new AppError(
    "An account with this email already exists",
    409,
    ErrorCodes.EMAIL_ALREADY_REGISTERED,
  );

// A still-unverified account is taken over: its password is replaced and a new code sent
// (root 3.2), so a typo'd or abandoned sign-up never locks the email.
export const register = async ({ email, password }) => {
  const existing = await User.findOne({ email }).lean();
  if (existing?.emailVerified) throw alreadyRegistered();

  const sendRecord = await reserveCodeSend(email, OtpPurpose.VERIFY_EMAIL);
  const passwordHash = await hashPassword(password);
  let user;
  try {
    user = await User.findOneAndUpdate(
      { email, emailVerified: false },
      { $set: { passwordHash } },
      { upsert: true, returnDocument: "after" },
    ).lean();
  } catch (error) {
    // The email was verified between the lookup and the upsert.
    if (error?.code === 11000) throw alreadyRegistered();
    throw error;
  }

  try {
    await issueAndSendCode(user, OtpPurpose.VERIFY_EMAIL);
  } catch (error) {
    // The account is kept; releasing the send lets resend-code recover right away.
    await releaseCodeSend(sendRecord);
    throw error;
  }
};

const invalidCode = () =>
  new AppError("The code is invalid or has expired", 400, ErrorCodes.INVALID_OR_EXPIRED_CODE);

export const verifyEmail = async ({ email, code }) => {
  const user = await User.findOne({ email }).lean();
  if (!user || user.emailVerified) throw invalidCode();
  await consumeCode(user._id, OtpPurpose.VERIFY_EMAIL, code);
  const verified = await User.findByIdAndUpdate(
    user._id,
    { $set: { emailVerified: true } },
    { returnDocument: "after" },
  ).lean();
  // Deleted meanwhile by the unverified-accounts job.
  if (!verified) throw invalidCode();
  return issueCustomerSession(verified);
};
