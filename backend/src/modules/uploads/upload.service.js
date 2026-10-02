import { randomUUID } from "node:crypto";
import { ErrorCodes, UPLOAD_URLS_PER_HOUR, UPLOAD_URLS_PER_IST_DAY } from "@medstore/shared";
import mongoose from "mongoose";
import { createSignedUploadUrl } from "../../services/storage.js";
import { AppError, invalidToken } from "../../utils/AppError.js";
import { istDayStart } from "../../utils/time.js";
import { User } from "../users/user.model.js";
import { Upload } from "./upload.model.js";

const HOUR_MS = 60 * 60 * 1000;

const EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png" };

const limitReached = (message) => new AppError(message, 429, ErrorCodes.UPLOAD_LIMIT_REACHED);

// Both windows end now; the daily one starts at IST midnight. Sequential: operations in one
// transaction session must not run in parallel.
const assertWithinLimits = async (userId, now, session) => {
  const since = (start) =>
    Upload.countDocuments({ userId, createdAt: { $gte: start } }, { session });
  if ((await since(new Date(now.getTime() - HOUR_MS))) >= UPLOAD_URLS_PER_HOUR) {
    throw limitReached(`You can upload up to ${UPLOAD_URLS_PER_HOUR} photos an hour`);
  }
  if ((await since(istDayStart(now))) >= UPLOAD_URLS_PER_IST_DAY) {
    throw limitReached(`You can upload up to ${UPLOAD_URLS_PER_IST_DAY} photos a day`);
  }
};

// Bumping the user document first makes concurrent requests of one customer conflict, so the
// transaction driver retries them one at a time and the limits stay exact.
const recordUpload = (userId, { contentType, sizeBytes }) =>
  mongoose.connection.transaction(async (session) => {
    const user = await User.findOneAndUpdate(
      { _id: userId },
      { $inc: { uploadIssueSeq: 1 } },
      { session, projection: { isBlocked: 1 } },
    ).lean();
    // Deleted since the request was authenticated.
    if (!user) throw invalidToken();
    if (user.isBlocked) {
      throw new AppError(
        "Your account can't place orders right now",
        403,
        ErrorCodes.ACCOUNT_BLOCKED,
      );
    }
    await assertWithinLimits(userId, new Date(), session);
    // Always built here, never taken from the request; a template string, never node:path.
    const path = `${userId}/${randomUUID()}.${EXTENSIONS[contentType]}`;
    const [upload] = await Upload.create([{ userId, path, contentType, sizeBytes }], { session });
    return upload;
  });

// Recorded before the URL is signed, so every URL handed out is tracked. Signing runs outside the
// transaction (no lock held across a network call); if it fails, the record is removed so it
// doesn't count toward the limits.
export const createPrescriptionUploadUrl = async (userId, input) => {
  const upload = await recordUpload(userId, input);
  try {
    return await createSignedUploadUrl(upload.path);
  } catch (error) {
    await Upload.deleteOne({ _id: upload._id });
    throw error;
  }
};
