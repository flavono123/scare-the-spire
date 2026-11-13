import type { ServiceLocale } from "@/lib/i18n";
import type { STS2Patch } from "@/lib/types";

export function getPatchVersionLabel(patch: STS2Patch, serviceLocale: ServiceLocale): string {
  if (serviceLocale === "ko") {
    return patch.versionLabelKo ?? patch.versionLabel ?? `v${patch.version}`;
  }

  return patch.versionLabel ?? patch.versionLabelKo ?? `v${patch.version}`;
}

export function isPatchDraft(patch: STS2Patch): boolean {
  if (patch.draft !== true) return false;
  return !patch.status || patch.status === "ready";
}

/** When a patch counts as new for unread dots: its Steam post time, else noon UTC of its date. */
export function patchPublishedAt(patch: Pick<STS2Patch, "date" | "publishedAt">): string {
  return patch.publishedAt ?? `${patch.date}T12:00:00.000Z`;
}
