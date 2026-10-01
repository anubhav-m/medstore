import { CONSENT_VERSION, ErrorCodes } from "@medstore/shared";
import mongoose from "mongoose";
import { AppError } from "../../utils/AppError.js";
import { insertAddress } from "../addresses/address.service.js";
import { User } from "./user.model.js";

export const toAuthUser = (user) => ({
  id: String(user._id),
  email: user.email,
  emailVerified: user.emailVerified,
  onboardingCompleted: user.onboardingCompleted,
});

// Needs passwordHash selected; only whether it exists is returned.
const toProfile = (user) => ({
  ...toAuthUser(user),
  isBlocked: user.isBlocked ?? false,
  hasPassword: Boolean(user.passwordHash),
  name: user.name ?? null,
  phone: user.phone ?? null,
  dob: user.dob ? user.dob.toISOString().slice(0, 10) : null,
  gender: user.gender ?? null,
  consentAcceptedAt: user.consentAcceptedAt ?? null,
  consentVersion: user.consentVersion ?? null,
});

const invalidSession = () => new AppError("Invalid session", 401, ErrorCodes.INVALID_TOKEN);

export const getMe = async (userId) => {
  const user = await User.findById(userId).select("+passwordHash").lean();
  if (!user) throw invalidSession();
  return toProfile(user);
};

// `null` clears dob / gender; fields that weren't sent are left alone.
export const updateMe = async (userId, { name, phone, dob, gender }) => {
  const changes = Object.fromEntries(
    Object.entries({ name, phone, dob, gender }).filter(([, value]) => value !== undefined),
  );
  const user = await User.findByIdAndUpdate(
    userId,
    { $set: changes },
    { returnDocument: "after", runValidators: true },
  )
    .select("+passwordHash")
    .lean();
  if (!user) throw invalidSession();
  return toProfile(user);
};

// The profile, consent and first (default) address are saved together or not at all. The
// conditional update also makes concurrent calls conflict, so only one can succeed.
export const completeOnboarding = (userId, { name, phone, address }) =>
  mongoose.connection.transaction(async (session) => {
    const user = await User.findOneAndUpdate(
      { _id: userId, onboardingCompleted: false },
      {
        $set: {
          name,
          phone,
          onboardingCompleted: true,
          consentAcceptedAt: new Date(),
          consentVersion: CONSENT_VERSION,
        },
      },
      { session, returnDocument: "after", runValidators: true },
    )
      .select("+passwordHash")
      .lean();
    if (!user) {
      throw new AppError(
        "Onboarding is already complete",
        409,
        ErrorCodes.ONBOARDING_ALREADY_COMPLETED,
      );
    }
    const firstAddress = await insertAddress(userId, address, true, session);
    return { user: toProfile(user), address: firstAddress };
  });
