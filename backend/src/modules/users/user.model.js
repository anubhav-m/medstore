import { Gender } from "@medstore/shared";
import mongoose from "mongoose";
import { pushTokenSchema } from "../notifications/pushToken.schema.js";

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
    // Set by the owner when blocking; all null while not blocked.
    blockedAt: { type: Date, default: null },
    blockedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    blockReason: { type: String, default: null },
    pushTokens: { type: [pushTokenSchema], default: [] },
    // Bumped first inside every address-write transaction, so concurrent address writes for one
    // customer conflict and run one at a time (address cap, single default).
    addressWriteSeq: { type: Number, default: 0, select: false },
    // Bumped first when issuing an upload URL, so concurrent requests run one at a time and the
    // hourly and daily upload limits stay exact.
    uploadIssueSeq: { type: Number, default: 0, select: false },
    // Bumped first inside every order-creation transaction, so concurrent creates and reorders of
    // one customer run one at a time (open-order limit, idempotency key).
    orderCreateSeq: { type: Number, default: 0, select: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.__v;
        delete ret.passwordHash;
        delete ret.googleId;
        delete ret.addressWriteSeq;
        delete ret.uploadIssueSeq;
        delete ret.orderCreateSeq;
        delete ret.pushTokens;
        delete ret.blockedBy;
        delete ret.blockReason;
        return ret;
      },
    },
  },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ googleId: 1 }, { unique: true, sparse: true });
// Registering a token removes it from every other account.
userSchema.index({ "pushTokens.token": 1 });
// The unverified-accounts job.
userSchema.index({ updatedAt: 1 }, { partialFilterExpression: { emailVerified: false } });

export const User = mongoose.model("User", userSchema);
