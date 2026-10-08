export const ADMIN_TAB_IDS = [
  "contact",
  "metrics",
  "authors",
  "comments",
  "posts",
  "nicks",
] as const;

export type AdminTabId = (typeof ADMIN_TAB_IDS)[number];

export function isAdminTabId(value: unknown): value is AdminTabId {
  return typeof value === "string" && (ADMIN_TAB_IDS as readonly string[]).includes(value);
}
