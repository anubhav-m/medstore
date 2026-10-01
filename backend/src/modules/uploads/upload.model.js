import { ALLOWED_IMAGE_TYPES } from "@medstore/shared";
import mongoose from "mongoose";

// One per signed upload URL issued, so an order can only use paths issued to its customer.
const uploadSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // `{userId}/{uuid}.{jpg|png}` inside the bucket
    path: { type: String, required: true },
    contentType: { type: String, enum: [...ALLOWED_IMAGE_TYPES], required: true },
    // As declared by the app; the stored object's real size is checked when an order uses it.
    sizeBytes: { type: Number, required: true },
    // Set when an order first uses the path; unattached uploads are cleaned up later.
    attachedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

uploadSchema.index({ path: 1 }, { unique: true });
// The per-customer hourly and daily limits.
uploadSchema.index({ userId: 1, createdAt: 1 });

export const Upload = mongoose.model("Upload", uploadSchema);
