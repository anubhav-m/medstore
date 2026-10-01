import mongoose from "mongoose";

// One entry per device on users and admins. `createdAt` orders them, so the oldest is dropped
// beyond MAX_PUSH_TOKENS_PER_ACCOUNT.
export const pushTokenSchema = new mongoose.Schema(
  { token: { type: String, required: true }, createdAt: { type: Date, required: true } },
  { _id: false },
);
