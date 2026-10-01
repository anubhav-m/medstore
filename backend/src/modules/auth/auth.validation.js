import {
  CUSTOMER_PASSWORD_MAX_LENGTH,
  CUSTOMER_PASSWORD_MIN_LENGTH,
  EMAIL_MAX_LENGTH,
  OTP_CODE_LENGTH,
  OtpPurpose,
} from "@medstore/shared";
import { z } from "zod";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(EMAIL_MAX_LENGTH)
  .pipe(z.email("Enter a valid email address"));

// Passwords are never trimmed: spaces are valid characters.
const password = z
  .string()
  .min(CUSTOMER_PASSWORD_MIN_LENGTH, `Use at least ${CUSTOMER_PASSWORD_MIN_LENGTH} characters`)
  .max(CUSTOMER_PASSWORD_MAX_LENGTH, `Use at most ${CUSTOMER_PASSWORD_MAX_LENGTH} characters`);

const code = z
  .string()
  .trim()
  .regex(new RegExp(`^\\d{${OTP_CODE_LENGTH}}$`), `Enter the ${OTP_CODE_LENGTH}-digit code`);

// Our refresh tokens are 43 characters; the bound only stops oversized input.
const refreshToken = z.string().min(1).max(256);

export const registerSchema = { body: z.strictObject({ email, password }) };
export const verifyEmailSchema = { body: z.strictObject({ email, code }) };
export const resendCodeSchema = {
  body: z.strictObject({ email, purpose: z.enum(OtpPurpose) }),
};
// Login doesn't enforce the sign-up length rules beyond a bound, so the error never hints
// at what a valid password looks like.
export const loginSchema = {
  body: z.strictObject({ email, password: z.string().min(1).max(CUSTOMER_PASSWORD_MAX_LENGTH) }),
};
export const googleSchema = { body: z.strictObject({ idToken: z.string().min(1).max(4096) }) };
export const forgotPasswordSchema = { body: z.strictObject({ email }) };
export const resetPasswordSchema = {
  body: z.strictObject({ email, code, newPassword: password }),
};
export const refreshSchema = { body: z.strictObject({ refreshToken }) };
export const logoutSchema = { body: z.strictObject({ refreshToken }) };
