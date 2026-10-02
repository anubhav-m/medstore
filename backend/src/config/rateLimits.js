const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

// The only place rate-limit numbers live; createApp accepts overrides so tests can use low limits.
// Per-email code-send limits and per-customer upload-URL limits are domain limits (root 3.8, in
// @medstore/shared) enforced in otp.service.js and upload.service.js.
export const rateLimits = {
  global: { windowMs: FIFTEEN_MINUTES, limit: 300 },
  // register, google, resend-code, forgot-password — per IP
  authIp: { windowMs: FIFTEEN_MINUTES, limit: 20 },
  // per IP + email (root 3.8)
  customerLogin: { windowMs: FIFTEEN_MINUTES, limit: 10 },
  // Failed customer logins per IP across emails (credential stuffing). Failed only: many customers
  // share an IP behind mobile carriers' NAT.
  customerLoginIp: { windowMs: FIFTEEN_MINUTES, limit: 30 },
  // verify-email, reset-password — per IP, on top of the attempts allowed per code
  codeCheck: { windowMs: FIFTEEN_MINUTES, limit: 20 },
  // Admin login and change-password count failed attempts only (root 3.8).
  adminLogin: { windowMs: FIFTEEN_MINUTES, limit: 5 }, // per username
  adminLoginIp: { windowMs: FIFTEEN_MINUTES, limit: 20 }, // per IP
  refresh: { windowMs: FIFTEEN_MINUTES, limit: 30 },
  // Customer and admin logout, per IP
  logout: { windowMs: FIFTEEN_MINUTES, limit: 30 },
  // Password / Google re-authentication of a signed-in customer (POST /me/password and DELETE /me,
  // one shared counter), per customer, so a stolen access token can't be used to guess the password.
  customerReauth: { windowMs: FIFTEEN_MINUTES, limit: 10 },
  // Order creations + reorders, per customer (root 3.8)
  orderCreate: { windowMs: ONE_HOUR, limit: 10 },
};
