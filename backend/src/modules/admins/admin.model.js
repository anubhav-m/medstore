import { AdminRole } from "@medstore/shared";
import mongoose from "mongoose";

// Created only by the CLI scripts (root 3.1); push tokens arrive with notifications.
const adminSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(AdminRole), required: true },
    storeIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Store" }], default: [] },
    isActive: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.__v;
        delete ret.passwordHash;
        return ret;
      },
    },
  },
);

adminSchema.index({ username: 1 }, { unique: true });

export const Admin = mongoose.model("Admin", adminSchema);
