import type { Address, AddressInput } from "./addresses.js";

/** Version of the terms & privacy policy a customer accepts at onboarding. */
export const CONSENT_VERSION = "2026-10-02";

export const Gender = {
  MALE: "MALE",
  FEMALE: "FEMALE",
  OTHER: "OTHER",
} as const;

export type Gender = (typeof Gender)[keyof typeof Gender];

export interface CustomerProfile {
  id: string;
  email: string;
  emailVerified: boolean;
  onboardingCompleted: boolean;
  isBlocked: boolean;
  hasPassword: boolean;
  name: string | null;
  /** `+91XXXXXXXXXX` */
  phone: string | null;
  /** `YYYY-MM-DD` */
  dob: string | null;
  gender: Gender | null;
  /** ISO 8601 */
  consentAcceptedAt: string | null;
  consentVersion: string | null;
}

/** `data` of GET /me and PATCH /me. */
export interface MeResponse {
  user: CustomerProfile;
}

/**
 * At least one field. `phone` accepts `9876543210`, `+919876543210` or `09876543210`, with spaces
 * or dashes. `null` clears `dob` / `gender`.
 */
export interface UpdateProfileRequest {
  name?: string;
  phone?: string;
  /** `YYYY-MM-DD`, from `DOB_MIN` to yesterday (IST) */
  dob?: string | null;
  gender?: Gender | null;
}

export interface OnboardingRequest {
  name: string;
  phone: string;
  address: AddressInput;
  consentAccepted: true;
}

/** `data` of POST /me/onboarding. */
export interface OnboardingResponse {
  user: CustomerProfile;
  address: Address;
}

/**
 * DELETE /me re-authenticates: accounts with a password send it (`hasPassword`); Google-only
 * accounts send a fresh Google ID token. The response has no `data`.
 */
export type DeleteAccountRequest = { password: string } | { googleIdToken: string };
