import {
  localizeHrefWithGameLocale,
  stripGameLocaleFromPath,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";

import { sanitizeContactSourcePath } from "@/lib/contact-rules";

// The Worker uses the same rule, so it lives in the import-free contact-rules.ts.
export { sanitizeContactSourcePath };

export function getContactHref(
  pathname: string,
  serviceLocale: ServiceLocale,
  gameLocale: GameLocale,
): string {
  const href = localizeHrefWithGameLocale("/contact", serviceLocale, gameLocale);
  const sourcePath = sanitizeContactSourcePath(pathname);
  if (stripGameLocaleFromPath(sourcePath) === "/contact") return href;
  return `${href}?from=${encodeURIComponent(sourcePath)}`;
}
