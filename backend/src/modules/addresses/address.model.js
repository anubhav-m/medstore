import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    label: { type: String, required: true, trim: true },
    // house / flat
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true, default: null },
    landmark: { type: String, trim: true, default: null },
    city: { type: String, required: true, trim: true },
    pincode: { type: String, required: true },
    // GeoJSON: coordinates are [lng, lat]
    location: {
      type: { type: String, enum: ["Point"], required: true },
      coordinates: { type: [Number], required: true },
    },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Every per-customer query, and picking the newest address as the next default.
addressSchema.index({ userId: 1, createdAt: -1 });
// The database itself refuses a second default address.
addressSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { isDefault: true }, name: "one_default_per_user" },
);

export const Address = mongoose.model("Address", addressSchema);
