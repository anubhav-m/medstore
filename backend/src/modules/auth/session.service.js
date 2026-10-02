import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { env } from "../../config/env.js";
import { invalidToken } from "../../utils/AppError.js";
import { removeAllPushTokens, removePushToken } from "../notifications/pushToken.service.js";
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

// Devices signed out this way also stop receiving notifications; the current device re-registers
// its push token after a password change.
export const revokeAllSessions = async (subjectKind, subjectId) => {
  await RefreshToken.updateMany(
    { subjectKind, subjectId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
  await removeAllPushTokens(subjectKind, subjectId);
};

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

// Scoped by kind, so one world's logout can never revoke the other's tokens. The push token is
// removed only from the account the refresh token was issued to (even if it is already revoked,
// e.g. by a password change elsewhere), so nobody can remove another account's token this way.
export const logout = async (subjectKind, { refreshToken, pushToken }) => {
  const session = await RefreshToken.findOne(
    { tokenHash: hashToken(refreshToken), subjectKind },
    { subjectId: 1 },
  ).lean();
  if (!session) return;
  await RefreshToken.updateOne(
    { _id: session._id, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
  if (pushToken) await removePushToken(subjectKind, session.subjectId, pushToken);
};

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
