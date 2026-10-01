export const OtpPurpose = {
  VERIFY_EMAIL: "VERIFY_EMAIL",
  RESET_PASSWORD: "RESET_PASSWORD",
} as const;

export type OtpPurpose = (typeof OtpPurpose)[keyof typeof OtpPurpose];

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface VerifyEmailRequest {
  email: string;
  code: string;
}

export interface ResendCodeRequest {
  email: string;
  purpose: OtpPurpose;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface GoogleAuthRequest {
  idToken: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  code: string;
  newPassword: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface LogoutRequest {
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  emailVerified: boolean;
  onboardingCompleted: boolean;
}

/** `data` of verify-email, login, google and refresh. */
export interface AuthSession {
  accessToken: string;
  /** ISO 8601 */
  accessTokenExpiresAt: string;
  refreshToken: string;
  user: AuthUser;
}
