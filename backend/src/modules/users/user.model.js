import mongoose from "mongoose";

// Auth fields only; onboarding adds the profile fields.
const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true },
    emailVerified: { type: Boolean, default: false },
    // null for Google-only accounts
    passwordHash: { type: String, default: null, select: false },
    googleId: { type: String, select: false },
    onboardingCompleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.__v;
        delete ret.passwordHash;
        delete ret.googleId;
        return ret;
      },
    },
  },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ googleId: 1 }, { unique: true, sparse: true });

export const User = mongoose.model("User", userSchema);
