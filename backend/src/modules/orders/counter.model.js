import mongoose from "mongoose";

// One per store, keyed by store code; never reset, so order numbers are never reused.
const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { versionKey: false },
);

const Counter = mongoose.model("Counter", counterSchema);

const SEQUENCE_DIGITS = 6;

// `{storeCode}-{000042}` from an atomic $inc. Taken outside the creation transaction, so a create
// that fails afterwards leaves a gap (acceptable, root 3.4).
export const nextOrderNumber = async (storeCode) => {
  const { seq } = await Counter.findOneAndUpdate(
    { _id: storeCode },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" },
  ).lean();
  return `${storeCode}-${String(seq).padStart(SEQUENCE_DIGITS, "0")}`;
};
