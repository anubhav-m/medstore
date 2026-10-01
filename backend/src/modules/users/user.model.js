import { Gender } from "@medstore/shared";
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true },
    emailVerified: { type: Boolean, default: false },
    // null for Google-only accounts
    passwordHash: { type: String, default: null, select: false },
    googleId: { type: String, select: false },
    name: { type: String, trim: true, default: null },
    // +91XXXXXXXXXX, unverified in v1
    phone: { type: String, default: null },
    // UTC midnight of the date of birth
    dob: { type: Date, default: null },
    gender: { type: String, enum: Object.values(Gender), default: null },
    onboardingCompleted: { type: Boolean, default: false },
    consentAcceptedAt: { type: Date, default: null },
    consentVersion: { type: String, default: null },
    isBlocked: { type: Boolean, default: false },
    // Bumped first inside every address-write transaction, so concurrent address writes for one
    // customer conflict and run one at a time (address cap, single default).
    addressWriteSeq: { type: Number, default: 0, select: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.__v;
        delete ret.passwordHash;
        delete ret.googleId;
        delete ret.addressWriteSeq;
        return ret;
      },
    },
  },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ googleId: 1 }, { unique: true, sparse: true });

export const User = mongoose.model("User", userSchema);
