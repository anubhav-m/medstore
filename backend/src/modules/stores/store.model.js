import mongoose from "mongoose";

// Created and edited by the owner; `code` is part of every order number, so it never changes.
const storeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true, immutable: true },
    name: { type: String, required: true, trim: true },
    address: {
      line1: { type: String, required: true, trim: true },
      line2: { type: String, trim: true, default: null },
      city: { type: String, required: true, trim: true },
      pincode: { type: String, required: true },
    },
    // +91XXXXXXXXXX
    phone: { type: String, required: true },
    // GeoJSON: coordinates are [lng, lat]
    location: {
      type: { type: String, enum: ["Point"], required: true },
      coordinates: { type: [Number], required: true },
    },
    deliveryRadiusKm: { type: Number, required: true },
    // Minutes after midnight IST; opening < closing
    openingMinutes: { type: Number, required: true },
    closingMinutes: { type: Number, required: true },
    deliveryFeePaise: { type: Number, required: true },
    isAcceptingOrders: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

storeSchema.index({ code: 1 }, { unique: true });
storeSchema.index({ location: "2dsphere" });

export const Store = mongoose.model("Store", storeSchema);
