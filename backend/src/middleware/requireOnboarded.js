import { ErrorCodes } from "@medstore/shared";
import { AppError } from "../utils/AppError.js";

// Runs after authCustomer, which loads onboardingCompleted from the database.
export const requireOnboarded = (req, _res, next) => {
  if (req.user.onboardingCompleted) return next();
  return next(
    new AppError("Complete your profile to continue", 403, ErrorCodes.ONBOARDING_REQUIRED),
  );
};
