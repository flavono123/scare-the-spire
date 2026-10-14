import { getGameLocaleFromPathname, type GameLocale } from "@/lib/i18n";

export interface ImageCaptureSnapshot {
  gameLocale: GameLocale;
  version: string;
}

export function imageCaptureSnapshotFromHref(href: string): ImageCaptureSnapshot {
  const url = new URL(href);
  return {
    gameLocale: getGameLocaleFromPathname(url.pathname),
    version: url.searchParams.get("version")?.replace(/^v/i, "") ?? "",
  };
}

export function imageCaptureSnapshotsEqual(
  left: ImageCaptureSnapshot,
  right: ImageCaptureSnapshot,
): boolean {
  return left.gameLocale === right.gameLocale && left.version === right.version;
}

export function elementMatchesImageCaptureSnapshot(
  gameLocale: string | undefined,
  version: string | undefined,
  snapshot: ImageCaptureSnapshot,
): boolean {
  if (gameLocale !== snapshot.gameLocale) return false;
  if (!snapshot.version) return Boolean(version);
  return version === snapshot.version;
}
