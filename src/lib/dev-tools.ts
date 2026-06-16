export function devToolsEnabled(): boolean {
  return process.env.NODE_ENV === "development"
    || process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS === "1"
    || process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS === "true";
}
