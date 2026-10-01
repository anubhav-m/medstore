import { createHash, randomBytes } from "node:crypto";
import { ErrorCodes } from "@medstore/shared";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";
import { User } from "../users/user.model.js";
import { toAuthUser } from "../users/user.service.js";
import { RefreshToken, SubjectKind } from "./refreshToken.model.js";

export const CUSTOMER_AUDIENCE = "customer";
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const CUSTOMER_REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const hashToken = (token) => createHash("sha256").update(token).digest("hex");

const invalidToken = () => new AppError("Invalid session", 401, ErrorCodes.INVALID_TOKEN);

const createRefreshToken = async (subjectKind, subjectId, ttlMs) => {
  const token = randomBytes(32).toString("base64url");
  await RefreshToken.create({
    tokenHash: hashToken(token),
    subjectKind,
    subjectId,
    expiresAt: new Date(Date.now() + ttlMs),
  });
  return token;
};

export const revokeAllSessions = (subjectKind, subjectId) =>
  RefreshToken.updateMany(
    { subjectKind, subjectId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );

// One conditional update; a token that is known but already revoked is reuse of a rotated
// token, so every session of that subject is revoked.
const rotateRefreshToken = async (token, subjectKind) => {
  const now = new Date();
  const tokenHash = hashToken(token);
  const rotated = await RefreshToken.findOneAndUpdate(
    { tokenHash, subjectKind, revokedAt: null, expiresAt: { $gt: now } },
    { $set: { revokedAt: now } },
  ).lean();
  if (rotated) return rotated.subjectId;

  const known = await RefreshToken.findOne({ tokenHash, subjectKind }).lean();
  if (known?.revokedAt) await revokeAllSessions(subjectKind, known.subjectId);
  throw invalidToken();
};

export const revokeRefreshToken = (token) =>
  RefreshToken.updateOne(
    { tokenHash: hashToken(token), revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );

export const issueCustomerSession = async (user) => {
  const expiresAtSeconds = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS;
  const accessToken = jwt.sign({ exp: expiresAtSeconds }, env.JWT_CUSTOMER_ACCESS_SECRET, {
    algorithm: "HS256",
    audience: CUSTOMER_AUDIENCE,
    subject: String(user._id),
  });
  const refreshToken = await createRefreshToken(
    SubjectKind.CUSTOMER,
    user._id,
    CUSTOMER_REFRESH_TTL_MS,
  );
  return {
    accessToken,
    accessTokenExpiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
    refreshToken,
    user: toAuthUser(user),
  };
};

export const refreshCustomerSession = async (token) => {
  const userId = await rotateRefreshToken(token, SubjectKind.CUSTOMER);
  const user = await User.findById(userId).lean();
  if (!user) throw invalidToken();
  return issueCustomerSession(user);
};
