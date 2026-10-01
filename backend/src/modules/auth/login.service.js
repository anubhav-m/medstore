import { ErrorCodes, OtpPurpose } from "@medstore/shared";
import { verifyGoogleIdToken } from "../../services/googleAuth.js";
import { AppError } from "../../utils/AppError.js";
import { verifyPassword } from "../../utils/password.js";
import { User } from "../users/user.model.js";
import { sendCodeIfAllowed } from "./otp.service.js";
import { issueCustomerSession } from "./session.service.js";

const invalidCredentials = (message = "Invalid email or password") =>
  new AppError(message, 401, ErrorCodes.INVALID_CREDENTIALS);

// Unknown emails still run an argon2 verify (against a dummy hash), so timing and response
// are identical to a wrong password.
export const login = async ({ email, password }) => {
  const user = await User.findOne({ email }).select("+passwordHash").lean();
  if (!(await verifyPassword(user?.passwordHash, password))) throw invalidCredentials();

  if (!user.emailVerified) {
    await sendCodeIfAllowed(user, OtpPurpose.VERIFY_EMAIL);
    throw new AppError(
      "Verify your email to continue. We sent you a new code.",
      403,
      ErrorCodes.EMAIL_NOT_VERIFIED,
    );
  }
  return issueCustomerSession(user);
};

// Linking to an unverified account deletes its password: whoever pre-registered the email
// without owning the inbox must not keep a way in (root 3.2).
const linkGoogleAccount = async (existing, googleId) => {
  const update = existing.emailVerified
    ? { $set: { googleId } }
    : { $set: { googleId, emailVerified: true, passwordHash: null } };
  const linked = await User.findOneAndUpdate(
    { _id: existing._id, googleId: { $exists: false } },
    update,
    { returnDocument: "after" },
  ).lean();
  if (!linked) throw invalidCredentials("Google sign-in failed");
  return linked;
};

export const loginWithGoogle = async ({ idToken }) => {
  const { googleId, email, emailVerified } = await verifyGoogleIdToken(idToken);
  if (!googleId || !email || !emailVerified) throw invalidCredentials("Google sign-in failed");

  const byGoogleId = await User.findOne({ googleId }).lean();
  if (byGoogleId) return issueCustomerSession(byGoogleId);

  const normalizedEmail = email.trim().toLowerCase();
  const byEmail = await User.findOne({ email: normalizedEmail }).select("+googleId").lean();
  // Already linked to a different Google account: never relink silently.
  if (byEmail?.googleId) throw invalidCredentials("Google sign-in failed");
  if (byEmail) return issueCustomerSession(await linkGoogleAccount(byEmail, googleId));

  const created = await User.create({ email: normalizedEmail, emailVerified: true, googleId });
  return issueCustomerSession(created);
};
