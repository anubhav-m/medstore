// The only place rate-limit numbers live; createApp accepts overrides so tests can use low limits.
export const rateLimits = {
  global: { windowMs: 15 * 60 * 1000, limit: 300 },
};
