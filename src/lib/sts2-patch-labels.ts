import type { ServiceLocale } from "@/lib/i18n";
import type { STS2Patch } from "@/lib/types";

export function getPatchVersionLabel(patch: STS2Patch, serviceLocale: ServiceLocale): string {
  if (serviceLocale === "ko") {
    return patch.versionLabelKo ?? patch.versionLabel ?? `v${patch.version}`;
  }

  return patch.versionLabel ?? patch.versionLabelKo ?? `v${patch.version}`;
}
