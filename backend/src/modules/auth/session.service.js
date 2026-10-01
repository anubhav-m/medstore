import { createHash, randomBytes } from "node:crypto";
import { ErrorCodes } from "@medstore/shared";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";
import { User } from "../users/user.model.js";
import { toAuthUser } from "../users/user.service.js";
import { RefreshToken, SubjectKind } from "./refreshToken.model.js";

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const DAY_MS = 24 * 60 * 60 * 1000;

// Separate secrets and audiences keep the two token worlds apart: neither can pass the other's
// middleware.
const SUBJECTS = {
  [SubjectKind.CUSTOMER]: {
    secret: env.JWT_CUSTOMER_ACCESS_SECRET,
    audience: "customer",
    refreshTtlMs: 30 * DAY_MS,
  },
  [SubjectKind.ADMIN]: {
    secret: env.JWT_ADMIN_ACCESS_SECRET,
    audience: "admin",
    refreshTtlMs: 7 * DAY_MS,
  },
};

const hashToken = (token) => createHash("sha256").update(token).digest("hex");

export const invalidToken = () => new AppError("Invalid session", 401, ErrorCodes.INVALID_TOKEN);

const createRefreshToken = async (subjectKind, subjectId) => {
  const token = randomBytes(32).toString("base64url");
  await RefreshToken.create({
    tokenHash: hashToken(token),
    subjectKind,
    subjectId,
    expiresAt: new Date(Date.now() + SUBJECTS[subjectKind].refreshTtlMs),
  });
  return token;
};

export const issueTokens = async (subjectKind, subjectId) => {
  const { secret, audience } = SUBJECTS[subjectKind];
  const expiresAtSeconds = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS;
  const accessToken = jwt.sign({ exp: expiresAtSeconds }, secret, {
    algorithm: "HS256",
    audience,
    subject: String(subjectId),
  });
  return {
    accessToken,
    accessTokenExpiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
    refreshToken: await createRefreshToken(subjectKind, subjectId),
  };
};

// Returns the subject id. jwt.verify throws TokenExpiredError / JsonWebTokenError, which the
// error handler classifies.
export const verifyAccessToken = (authorization, subjectKind) => {
  const [, token] = /^Bearer (\S+)$/.exec(authorization ?? "") ?? [];
  if (!token) throw invalidToken();

  const { secret, audience } = SUBJECTS[subjectKind];
  const { sub } = jwt.verify(token, secret, { algorithms: ["HS256"], audience });
  if (!mongoose.isObjectIdOrHexString(sub)) throw invalidToken();
  return sub;
};

export const revokeAllSessions = (subjectKind, subjectId) =>
  RefreshToken.updateMany(
    { subjectKind, subjectId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );

// One conditional update; reuse of an already-rotated token means it was copied, so every
// session of that subject is revoked. Returns the subject id.
export const rotateRefreshToken = async (token, subjectKind) => {
  const now = new Date();
  const tokenHash = hashToken(token);
  const rotated = await RefreshToken.findOneAndUpdate(
    { tokenHash, subjectKind, revokedAt: null, expiresAt: { $gt: now } },
    { $set: { revokedAt: now, rotatedAt: now } },
  ).lean();
  if (rotated) return rotated.subjectId;

  const known = await RefreshToken.findOne({ tokenHash, subjectKind }).lean();
  if (known?.rotatedAt) await revokeAllSessions(subjectKind, known.subjectId);
  throw invalidToken();
};

// Scoped by kind, so one world's logout can never revoke the other's tokens.
export const revokeRefreshToken = (token, subjectKind) =>
  RefreshToken.updateOne(
    { tokenHash: hashToken(token), subjectKind, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );

export const issueCustomerSession = async (user) => ({
  ...(await issueTokens(SubjectKind.CUSTOMER, user._id)),
  user: toAuthUser(user),
});

export const refreshCustomerSession = async (token) => {
  const userId = await rotateRefreshToken(token, SubjectKind.CUSTOMER);
  const user = await User.findById(userId).lean();
  if (!user) throw invalidToken();
  return issueCustomerSession(user);
};
