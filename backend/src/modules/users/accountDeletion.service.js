import { ErrorCodes, OPEN_ORDER_STATUSES } from "@medstore/shared";
import mongoose from "mongoose";
import { verifyGoogleIdToken } from "../../services/googleAuth.js";
import { AppError, invalidToken } from "../../utils/AppError.js";
import { verifyPassword } from "../../utils/password.js";
import { Address } from "../addresses/address.model.js";
import { OtpCode } from "../auth/otpCode.model.js";
import { RefreshToken, SubjectKind } from "../auth/refreshToken.model.js";
import { Order } from "../orders/order.model.js";
import { User } from "./user.model.js";

const invalidCredentials = (message) => new AppError(message, 401, ErrorCodes.INVALID_CREDENTIALS);

// A stolen access token alone can't delete an account (root 3.2): accounts with a password
// confirm it; Google-only accounts confirm with a fresh sign-in to the linked Google account.
const reauthenticate = async (user, { password, googleIdToken }) => {
  if (password !== undefined) {
    // An account without a password is verified against the dummy hash and fails.
    if (!(await verifyPassword(user.passwordHash, password))) {
      throw invalidCredentials("Incorrect password");
    }
    return;
  }
  // Google is the alternative only for accounts without a password, even when one is linked.
  if (user.passwordHash) throw invalidCredentials("Enter your password to delete your account");
  const { googleId } = await verifyGoogleIdToken(googleIdToken);
  if (!googleId || googleId !== user.googleId) {
    throw invalidCredentials("Sign in with the Google account linked to this profile");
  }
};

// Orders are kept with their copied name, phone and address, and their photos stay in the bucket
// (root D1). Deleting the user document first conflicts with any concurrent order creation,
// upload or address write of this customer (they all write it first), so the open-order check
// sees every order and nothing is written for the account after it is gone. Push tokens live on
// the user document.
export const deleteAccount = async (userId, credentials) => {
  const user = await User.findById(userId).select("+passwordHash +googleId").lean();
  if (!user) throw invalidToken();
  await reauthenticate(user, credentials);

  await mongoose.connection.transaction(async (session) => {
    const { deletedCount } = await User.deleteOne({ _id: userId }, { session });
    if (deletedCount === 0) throw invalidToken();

    const openOrder = await Order.exists({
      userId,
      status: { $in: OPEN_ORDER_STATUSES },
    }).session(session);
    if (openOrder) {
      throw new AppError(
        "Finish or cancel your orders in progress before deleting your account",
        409,
        ErrorCodes.ACCOUNT_HAS_OPEN_ORDERS,
      );
    }

    await Address.deleteMany({ userId }, { session });
    await RefreshToken.deleteMany(
      { subjectKind: SubjectKind.CUSTOMER, subjectId: userId },
      { session },
    );
    await OtpCode.deleteMany({ userId }, { session });
  });
};
