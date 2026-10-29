export const ROLES = ["unverified", "verified", "admin"] as const;

export type Role = (typeof ROLES)[number];
