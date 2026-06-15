export const DEFAULT_SITE_ORIGIN = "https://scare-the-spire.vercel.app";

export function getSiteOrigin(): string {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_ORIGIN?.trim();
  if (!configuredOrigin) return DEFAULT_SITE_ORIGIN;

  try {
    return new URL(configuredOrigin).origin;
  } catch {
    return DEFAULT_SITE_ORIGIN;
  }
}

export function getSiteDisplayOrigin(): string {
  return getSiteOrigin().replace(/^https?:\/\//, "");
}
