import { ErrorCodes } from "@medstore/shared";
import { OAuth2Client } from "google-auth-library";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { AppError } from "../utils/AppError.js";

const client = new OAuth2Client();

// Fields may be undefined; the caller decides what a missing or unverified email means.
export const verifyGoogleIdToken = async (idToken) => {
  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: env.GOOGLE_WEB_CLIENT_ID });
    payload = ticket.getPayload();
  } catch (error) {
    logger.warn({ errorName: error.name }, "google id token rejected");
    throw new AppError("Google sign-in failed", 401, ErrorCodes.INVALID_CREDENTIALS);
  }
  return {
    googleId: payload?.sub,
    email: payload?.email,
    emailVerified: payload?.email_verified === true,
  };
};
