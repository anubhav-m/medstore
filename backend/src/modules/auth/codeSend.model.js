import { OtpPurpose } from "@medstore/shared";
import mongoose from "mongoose";

// One document per code-send request, recorded whether or not the email has an account, so the
// per-email limits answer identically for known and unknown emails.
const codeSendSchema = new mongoose.Schema(
  {
    email: { type: String, required: true },
    purpose: { type: String, enum: Object.values(OtpPurpose), required: true },
  },
  { timestamps: true },
);

codeSendSchema.index({ email: 1, createdAt: 1 });
codeSendSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 });

export const CodeSend = mongoose.model("CodeSend", codeSendSchema);
