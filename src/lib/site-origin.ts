const DEFAULT_SITE_ORIGIN = "https://scare-the-spire.flavono123.workers.dev";

function normalizeSiteOrigin(value: string | undefined): string | null {
  if (!value) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export const SITE_ORIGIN =
  normalizeSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL) ??
  normalizeSiteOrigin(process.env.SITE_URL) ??
  DEFAULT_SITE_ORIGIN;

export const SITE_METADATA_BASE = new URL(SITE_ORIGIN);

export function absoluteSiteUrl(url: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
  return new URL(url.startsWith("/") ? url : `/${url}`, SITE_METADATA_BASE).toString();
}
