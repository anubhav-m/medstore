import mongoose from "mongoose";

// One per email, bumped first inside every code-send reservation, so concurrent requests for one
// email conflict and run one at a time — the per-email limits stay exact even for emails without
// an account. Kept 1 hour after its last use, like the sends it guards.
const codeSendLockSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false },
);

codeSendLockSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 60 * 60 });

export const CodeSendLock = mongoose.model("CodeSendLock", codeSendLockSchema);
