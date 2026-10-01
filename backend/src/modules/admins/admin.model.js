import { AdminRole } from "@medstore/shared";
import mongoose from "mongoose";
import { pushTokenSchema } from "../notifications/pushToken.schema.js";

// Created only by the CLI scripts (root 3.1).
const adminSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(AdminRole), required: true },
    storeIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Store" }], default: [] },
    isActive: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: true },
    pushTokens: { type: [pushTokenSchema], default: [] },
    lastLoginAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.__v;
        delete ret.passwordHash;
        delete ret.pushTokens;
        return ret;
      },
    },
  },
);

adminSchema.index({ username: 1 }, { unique: true });
// Registering a token removes it from every other account.
adminSchema.index({ "pushTokens.token": 1 });

export const Admin = mongoose.model("Admin", adminSchema);
