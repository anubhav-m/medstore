import { ErrorCodes, OTP_EXPIRY_MINUTES, OtpPurpose } from "@medstore/shared";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { AppError } from "../utils/AppError.js";

const RESEND_URL = "https://api.resend.com/emails";
const TIMEOUT_MS = 10_000;

const SUBJECTS = {
  [OtpPurpose.VERIFY_EMAIL]: "Your verification code",
  [OtpPurpose.RESET_PASSWORD]: "Your password reset code",
};

const unavailable = () =>
  new AppError(
    "We couldn't send the email. Please try again.",
    503,
    ErrorCodes.SERVICE_UNAVAILABLE,
  );

// Never log the recipient, code or body.
export const sendCodeEmail = async ({ to, code, purpose }) => {
  let response;
  try {
    response = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.EMAIL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [to],
        subject: SUBJECTS[purpose],
        text: [
          `Your code is ${code}.`,
          `It expires in ${OTP_EXPIRY_MINUTES} minutes.`,
          "If you didn't request this, you can ignore this email.",
        ].join("\n\n"),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    logger.error({ errorName: error.name }, "email provider unreachable");
    throw unavailable();
  }
  if (!response.ok) {
    logger.error({ providerStatus: response.status }, "email provider rejected the request");
    throw unavailable();
  }
};
