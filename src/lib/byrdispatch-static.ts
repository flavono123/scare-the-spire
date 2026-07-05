export const BYRDISPATCH_ICON = "/images/sts2/relics/byrdpip.webp";
export const BYRDISPATCH_NOTICE_ICON = "/images/sts2/powers/signal_boost_power.webp";
export const BYRDISPATCH_LATEST_NOTICE_PATH = "/generated/latest-byrdispatch-notice.json";
export const BYRDISPATCH_MIGRATION_TARGET_HOST = "scare-the-spire.flavono123.workers.dev";

export type ByrdispatchNotice = {
  date: string;
  text: string;
};

export function parseByrdispatchNoticeOriginHost(origin: string | undefined): string | null {
  if (!origin) return null;

  try {
    return new URL(origin).hostname;
  } catch {
    return null;
  }
}

export function isByrdispatchMigrationTargetHost(host: string | null | undefined): boolean {
  return host === BYRDISPATCH_MIGRATION_TARGET_HOST;
}

export function isConfiguredByrdispatchMigrationTargetHost(): boolean {
  return isByrdispatchMigrationTargetHost(
    parseByrdispatchNoticeOriginHost(process.env.NEXT_PUBLIC_SITE_ORIGIN),
  );
}

export function isByrdispatchMigrationNoticeText(text: string): boolean {
  return text.includes(BYRDISPATCH_MIGRATION_TARGET_HOST)
    && (text.includes("이전") || text.includes("운영되지"));
}
