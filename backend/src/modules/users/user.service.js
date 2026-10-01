import { ErrorCodes } from "@medstore/shared";
import { AppError } from "../../utils/AppError.js";
import { User } from "./user.model.js";

export const toAuthUser = (user) => ({
  id: String(user._id),
  email: user.email,
  emailVerified: user.emailVerified,
  onboardingCompleted: user.onboardingCompleted,
});

export const getMe = async (userId) => {
  const user = await User.findById(userId).lean();
  if (!user) throw new AppError("Invalid session", 401, ErrorCodes.INVALID_TOKEN);
  return toAuthUser(user);
};
