"use client";

import { getCodexServiceMessages } from "@/lib/codex-service";
import type { ServiceLocale } from "@/lib/i18n";
import { LOCALE_TEXT_PINNED_FROM, VERSION_TEXT_UNPINNED_FIELD } from "@/lib/localization-history";

/** True when a reconstructed entity shows text that this locale did not have at that version. */
export function isVersionTextUnpinned(entity: object | null | undefined): boolean {
  return Boolean(entity && (entity as Record<string, unknown>)[VERSION_TEXT_UNPINNED_FIELD]);
}

/**
 * Marks text this game locale did not keep for the selected version.
 * `tile` is a corner chip on one element, `note` sits beside the version
 * selector, and `banner` is a line on a detail page.
 */
export function VersionTextUnpinnedMark({
  serviceLocale,
  variant,
}: {
  serviceLocale: ServiceLocale;
  variant: "tile" | "note" | "banner";
}) {
  const copy = getCodexServiceMessages(serviceLocale).common;
  const detail = copy.versionTextUnpinnedDetail.replaceAll("{version}", `v${LOCALE_TEXT_PINNED_FROM}`);

  if (variant === "tile") {
    return (
      <span
        title={detail}
        aria-label={detail}
        data-version-text-unpinned
        className="pointer-events-auto absolute bottom-3 right-2 z-20 rounded border border-amber-400/60 bg-black/80 px-1.5 text-xs font-bold leading-5 text-amber-300"
      >
        *
      </span>
    );
  }

  if (variant === "note") {
    return (
      <span title={detail} data-version-text-unpinned className="shrink-0 text-[11px] text-amber-300/90">
        * {copy.versionTextUnpinned}
      </span>
    );
  }

  return (
    <p
      data-version-text-unpinned
      className="mx-auto w-full max-w-md rounded-md border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-xs text-amber-200"
    >
      * {detail}
    </p>
  );
}
