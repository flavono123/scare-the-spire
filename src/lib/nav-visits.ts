import { dataEnv } from "@/lib/data-env";
import { stripGameLocaleFromPath } from "@/lib/i18n";

/** localStorage, or null where the browser blocks it. */
export function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Visits per place id in this browser (localStorage), for menu order and search. */
export type NavVisits = Record<string, number>;

export function navVisitsStorageKey(env = dataEnv): string {
  return `sts-nav-visits:${env}`;
}

export function readNavVisits(storage: Pick<Storage, "getItem"> | null): NavVisits {
  try {
    const raw = storage?.getItem(navVisitsStorageKey());
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, number] => Number.isFinite(entry[1])),
    );
  } catch {
    return {};
  }
}

/** The place whose href is the path or its longest parent, e.g. /history-course/abc → history-course. */
export function placeIdForPath(
  pathname: string,
  places: readonly { id: string; href: string }[],
): string | null {
  const path = stripGameLocaleFromPath(pathname).replace(/\/+$/, "") || "/";
  let best: { id: string; length: number } | null = null;
  for (const place of places) {
    if (path !== place.href && !path.startsWith(`${place.href}/`)) continue;
    if (!best || place.href.length > best.length) best = { id: place.id, length: place.href.length };
  }
  return best?.id ?? null;
}

/** Counts one visit; without storage (private mode) nothing is kept and menus use their own order. */
export function recordNavVisit(
  storage: Pick<Storage, "getItem" | "setItem"> | null,
  pathname: string,
  places: readonly { id: string; href: string }[],
): void {
  const id = placeIdForPath(pathname, places);
  if (!id || !storage) return;
  try {
    const visits = readNavVisits(storage);
    visits[id] = (visits[id] ?? 0) + 1;
    storage.setItem(navVisitsStorageKey(), JSON.stringify(visits));
  } catch {
    // Storage full or blocked: skip.
  }
}

export type NavMenuEntry = { id: string; order: number; fold: boolean; isNew: boolean; unread: boolean };

/** Folded last; then new service or new post; then this browser's visits; then registry order. */
export function sortNavMenuEntries<T extends NavMenuEntry>(entries: readonly T[], visits: NavVisits): T[] {
  return [...entries].sort((a, b) => (
    Number(a.fold) - Number(b.fold)
    || Number(b.isNew || b.unread) - Number(a.isNew || a.unread)
    || (visits[b.id] ?? 0) - (visits[a.id] ?? 0)
    || a.order - b.order
  ));
}

const VISIT_BONUS_PER_VISIT = 20;
const VISIT_BONUS_MAX = 200;
const PLACE_SEARCH_TYPES = new Set(["compendium", "zzapper", "toybox", "patch"]);

/** Up to +200 search score for menu destinations this browser opens often; never lifts a tier. */
export function navVisitSearchBonus(visits: NavVisits): (item: { type: string; id: string }) => number {
  return (item) => (
    PLACE_SEARCH_TYPES.has(item.type)
      ? Math.min(VISIT_BONUS_MAX, (visits[item.id] ?? 0) * VISIT_BONUS_PER_VISIT)
      : 0
  );
}
