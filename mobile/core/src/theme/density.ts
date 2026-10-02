export type AppKind = "customer" | "admin";

export type Density = "comfortable" | "compact";

export const densityForApp: Record<AppKind, Density> = {
  customer: "comfortable",
  admin: "compact",
};
