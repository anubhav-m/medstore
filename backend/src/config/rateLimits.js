const FIFTEEN_MINUTES = 15 * 60 * 1000;

// The only place rate-limit numbers live; createApp accepts overrides so tests can use low limits.
// Per-email code-send limits are domain limits (root 3.8) enforced in otp.service.js.
export const rateLimits = {
  global: { windowMs: FIFTEEN_MINUTES, limit: 300 },
  // register, google, resend-code, forgot-password — per IP
  authIp: { windowMs: FIFTEEN_MINUTES, limit: 20 },
  // per IP + email (root 3.8)
  customerLogin: { windowMs: FIFTEEN_MINUTES, limit: 10 },
  // verify-email, reset-password — per IP, on top of the attempts allowed per code
  codeCheck: { windowMs: FIFTEEN_MINUTES, limit: 20 },
  // Admin login and change-password count failed attempts only (root 3.8).
  adminLogin: { windowMs: FIFTEEN_MINUTES, limit: 5 }, // per username
  adminLoginIp: { windowMs: FIFTEEN_MINUTES, limit: 20 }, // per IP
  refresh: { windowMs: FIFTEEN_MINUTES, limit: 30 },
};
