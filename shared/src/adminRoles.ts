export const AdminRole = {
  OWNER: "OWNER",
  STAFF: "STAFF",
} as const;

export type AdminRole = (typeof AdminRole)[keyof typeof AdminRole];
