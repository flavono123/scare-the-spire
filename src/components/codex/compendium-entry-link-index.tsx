import {
  buildCompendiumEntryHref,
  type CompendiumResourceLinkType,
} from "@/lib/compendium-resource-links";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";

export type CompendiumEntryLinkGroup = {
  type: CompendiumResourceLinkType;
  heading?: string;
  entries: readonly { id: string; name: string }[];
};

const SUMMARY_LABEL = {
  ko: "전체 목록",
  en: "All entries",
} as const;

/**
 * Plain links to every entry of a Compendium list. The interactive grid only
 * renders part of a list at a time, so this keeps every entry reachable from
 * the static HTML.
 */
export function CompendiumEntryLinkIndex({
  gameLocale,
  title,
  groups,
}: {
  gameLocale: GameLocale;
  title: string;
  groups: readonly CompendiumEntryLinkGroup[];
}) {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const count = groups.reduce((total, group) => total + group.entries.length, 0);
  if (count === 0) return null;

  return (
    <nav
      aria-label={`${title} ${SUMMARY_LABEL[serviceLocale]}`}
      className="border-t border-border bg-background px-4 py-3 text-foreground sm:px-6"
    >
      <details className="group mx-auto max-w-[92rem]">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-game-title text-sm font-bold text-gray-400 hover:text-gray-200">
          <span>{title} · {SUMMARY_LABEL[serviceLocale]} ({count})</span>
          <span className="text-xs transition-transform group-open:rotate-180">⌄</span>
        </summary>
        {groups.map((group) => (
          <section key={`${group.type}:${group.heading ?? ""}`} className="mt-3">
            {group.heading && (
              <h2 className="mb-1 font-service text-xs text-gray-500">{group.heading}</h2>
            )}
            <ul className="columns-2 gap-x-6 font-game-text text-sm sm:columns-3 lg:columns-5">
              {group.entries.map((entry) => (
                <li key={entry.id} className="break-inside-avoid py-0.5">
                  <a
                    href={buildCompendiumEntryHref(group.type, entry.id, gameLocale)}
                    className="text-gray-300 transition-colors hover:text-primary"
                  >
                    {entry.name}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </details>
    </nav>
  );
}
