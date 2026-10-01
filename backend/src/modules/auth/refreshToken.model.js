import mongoose from "mongoose";

export const SubjectKind = {
  CUSTOMER: "CUSTOMER",
  ADMIN: "ADMIN",
};

const refreshTokenSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true },
    subjectKind: { type: String, enum: Object.values(SubjectKind), required: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, required: true },
    expiresAt: { type: Date, required: true },
    // Rotated tokens stay (revoked) until they expire so reuse can be detected.
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

refreshTokenSchema.index({ tokenHash: 1 }, { unique: true });
refreshTokenSchema.index({ subjectKind: 1, subjectId: 1 });
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = mongoose.model("RefreshToken", refreshTokenSchema);
