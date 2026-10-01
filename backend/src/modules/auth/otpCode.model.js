import { OtpPurpose } from "@medstore/shared";
import mongoose from "mongoose";

const otpCodeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    purpose: { type: String, enum: Object.values(OtpPurpose), required: true },
    // HMAC-SHA256 keyed with OTP_HMAC_SECRET: a plain hash of 6 digits is trivially reversible.
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

otpCodeSchema.index({ userId: 1, purpose: 1 }, { unique: true });
// The TTL monitor runs with a delay, so expiry is also checked in otp.service.js.
otpCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OtpCode = mongoose.model("OtpCode", otpCodeSchema);
