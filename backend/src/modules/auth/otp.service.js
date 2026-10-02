import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import {
  CODE_RESEND_COOLDOWN_SECONDS,
  CODE_SENDS_PER_EMAIL_PER_HOUR,
  ErrorCodes,
  OTP_CODE_LENGTH,
  OTP_EXPIRY_MINUTES,
  OTP_MAX_ATTEMPTS,
  OtpPurpose,
} from "@medstore/shared";
import mongoose from "mongoose";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { sendCodeEmail } from "../../services/email.js";
import { AppError } from "../../utils/AppError.js";
import { User } from "../users/user.model.js";
import { CodeSend } from "./codeSend.model.js";
import { CodeSendLock } from "./codeSendLock.model.js";
import { OtpCode } from "./otpCode.model.js";

const ONE_HOUR_MS = 60 * 60 * 1000;

const hmac = (code) => createHmac("sha256", env.OTP_HMAC_SECRET).update(code).digest();

const invalidCode = () =>
  new AppError("The code is invalid or has expired", 400, ErrorCodes.INVALID_OR_EXPIRED_CODE);

// The checks and the insert run in one transaction that first bumps the email's lock document,
// so concurrent requests for one email run one at a time and the limits stay exact. The lock is
// created outside the transaction: concurrent first upserts inside one could fail with a
// non-transient duplicate key. Returns the record, or null when the limits are reached.
const tryReserveCodeSend = async (email, purpose) => {
  await CodeSendLock.updateOne({ _id: email }, { $setOnInsert: { seq: 0 } }, { upsert: true });
  return mongoose.connection.transaction(async (session) => {
    await CodeSendLock.updateOne({ _id: email }, { $inc: { seq: 1 } }, { session });
    const now = Date.now();
    const inCooldown = await CodeSend.exists({
      email,
      purpose,
      createdAt: { $gt: new Date(now - CODE_RESEND_COOLDOWN_SECONDS * 1000) },
    }).session(session);
    if (inCooldown) return null;
    const sentThisHour = await CodeSend.countDocuments(
      { email, createdAt: { $gt: new Date(now - ONE_HOUR_MS) } },
      { session },
    );
    if (sentThisHour >= CODE_SENDS_PER_EMAIL_PER_HOUR) return null;
    const [record] = await CodeSend.create([{ email, purpose }], { session });
    return record;
  });
};

// Throws 429 when the per-email limits are reached; returns the record so a failed send can
// release it.
export const reserveCodeSend = async (email, purpose) => {
  const record = await tryReserveCodeSend(email, purpose);
  if (!record) {
    throw new AppError(
      "Please wait before requesting another code",
      429,
      ErrorCodes.TOO_MANY_REQUESTS,
    );
  }
  return record;
};

export const releaseCodeSend = (record) => CodeSend.deleteOne({ _id: record._id });

// Replacing the document invalidates any previous code for this user and purpose.
export const issueAndSendCode = async (user, purpose) => {
  const code = String(randomInt(0, 10 ** OTP_CODE_LENGTH)).padStart(OTP_CODE_LENGTH, "0");
  await OtpCode.replaceOne(
    { userId: user._id, purpose },
    {
      userId: user._id,
      purpose,
      codeHash: hmac(code).toString("hex"),
      attempts: 0,
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
    },
    { upsert: true },
  );
  try {
    await sendCodeEmail({ to: user.email, code, purpose });
  } catch (error) {
    await OtpCode.deleteOne({ userId: user._id, purpose });
    throw error;
  }
};

// For flows that must not fail or reveal anything when a code can't be sent.
const sendQuietly = async (user, purpose) => {
  try {
    await issueAndSendCode(user, purpose);
  } catch (error) {
    logger.error({ err: error, userId: String(user._id), purpose }, "code email not sent");
  }
};

// Login with an unverified account: send a fresh code if the limits allow, silently otherwise.
export const sendCodeIfAllowed = async (user, purpose) => {
  if (await tryReserveCodeSend(user.email, purpose)) await sendQuietly(user, purpose);
};

// resend-code and forgot-password: the response is the same whether or not the email exists.
export const requestCode = async (email, purpose) => {
  await reserveCodeSend(email, purpose);
  const user = await User.findOne({ email }).lean();
  const eligible = user && (purpose === OtpPurpose.RESET_PASSWORD || !user.emailVerified);
  if (eligible) await sendQuietly(user, purpose);
};

// Every guess takes one attempt atomically before it is compared, so a code is compared at most
// OTP_MAX_ATTEMPTS times however many guesses arrive at once. Codes are single-use: a match is
// consumed by one conditional delete (the hash guards against a code replaced meanwhile).
export const consumeCode = async (userId, purpose, code) => {
  const otp = await OtpCode.findOneAndUpdate(
    { userId, purpose, attempts: { $lt: OTP_MAX_ATTEMPTS }, expiresAt: { $gt: new Date() } },
    { $inc: { attempts: 1 } },
    { returnDocument: "after" },
  ).lean();
  if (!otp) throw invalidCode();

  if (timingSafeEqual(Buffer.from(otp.codeHash, "hex"), hmac(code))) {
    const consumed = await OtpCode.findOneAndDelete({
      _id: otp._id,
      codeHash: otp.codeHash,
    }).lean();
    if (!consumed) throw invalidCode();
    return;
  }
  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    await OtpCode.deleteOne({ _id: otp._id, codeHash: otp.codeHash });
    throw new AppError(
      "Too many wrong codes. Request a new one.",
      429,
      ErrorCodes.TOO_MANY_ATTEMPTS,
    );
  }
  throw invalidCode();
};
