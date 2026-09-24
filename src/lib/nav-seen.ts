import { FAVORITE_TOURNAMENT_HREF } from "@/lib/favorite-tournament";
import { stripGameLocaleFromPath } from "@/lib/i18n";
import { PAGESTORM_HREF } from "@/lib/pagestorm";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";

export const NAV_SEEN_EVENT = "sts-nav-seen";

const STORAGE_PREFIX = "sts-nav-seen:";
const FORCE_PREFIX = "sts-nav-force:";
const UNREAD_CACHE_PREFIX = "sts-nav-unread:";
const UNREAD_CACHE_MS = 60_000;

export type NavSeenSurface = {
  id: string;
  href: string;
  label: string;
  table: "comments" | "combo_posts" | "transfigure_posts" | "this_or_that_posts" | "favorite_tournament_posts" | "chemical_posts" | "decisions_decisions_posts" | "pagestorm_posts" | "runs";
  storyLikes?: readonly string[];
  /** Menu row that should also light when this surface is unread. */
  alsoShowOn?: string;
};

export const NAV_SEEN_SURFACES: readonly NavSeenSurface[] = [
  { id: "patches", href: "/patches", label: "패치노트", table: "comments", storyLikes: ["sts2-patch:%", "neowsletter:%"] },
  { id: "combo", href: "/c-c-c-combo", label: "코오오옴보", table: "combo_posts" },
  { id: "transfigure", href: "/transfigure", label: "변형", table: "transfigure_posts" },
  { id: "this-or-that", href: "/this-or-that", label: "이거 아님 저거?", table: "this_or_that_posts" },
  {
    id: "favorite-tournament",
    href: FAVORITE_TOURNAMENT_HREF,
    label: "이아저? 월드컵",
    table: "favorite_tournament_posts",
    alsoShowOn: "this-or-that",
  },
  { id: "chemical-x", href: "/chemical-x", label: "케미컬X", table: "chemical_posts" },
  { id: "decisions-decisions", href: "/decisions-decisions", label: "어려운 결정", table: "decisions_decisions_posts" },
  { id: "pagestorm", href: PAGESTORM_HREF, label: "서류 폭풍", table: "pagestorm_posts" },
  { id: "history-course", href: "/history-course", label: "역사 강의서", table: "runs" },
];

export type NavSeenMap = Record<string, string>;
export type NavForceMap = Record<string, boolean>;

export function navSeenStorageKey(env = supabaseEnv): string {
  return `${STORAGE_PREFIX}${env}`;
}

export function navForceStorageKey(env = supabaseEnv): string {
  return `${FORCE_PREFIX}${env}`;
}

function emptySeen(now: string): NavSeenMap {
  return Object.fromEntries(NAV_SEEN_SURFACES.map((surface) => [surface.id, now]));
}

export function readNavSeen(storage: Pick<Storage, "getItem" | "setItem">, now = new Date().toISOString()): NavSeenMap {
  try {
    const raw = storage.getItem(navSeenStorageKey());
    const parsed = raw ? JSON.parse(raw) as Partial<NavSeenMap> : null;
    const base = emptySeen(now);
    if (!parsed || typeof parsed !== "object") {
      storage.setItem(navSeenStorageKey(), JSON.stringify(base));
      return base;
    }
    let changed = false;
    for (const surface of NAV_SEEN_SURFACES) {
      const value = parsed[surface.id];
      if (typeof value === "string" && value.length > 0) base[surface.id] = value;
      else changed = true;
    }
    if (changed || !raw) storage.setItem(navSeenStorageKey(), JSON.stringify(base));
    return base;
  } catch {
    return emptySeen(now);
  }
}

export function writeNavSeen(storage: Pick<Storage, "setItem">, seen: NavSeenMap): void {
  storage.setItem(navSeenStorageKey(), JSON.stringify(seen));
}

export function surfaceIdForPath(pathname: string): string | null {
  const path = stripGameLocaleFromPath(pathname);
  const matches = NAV_SEEN_SURFACES
    .filter((surface) => path === surface.href || path.startsWith(`${surface.href}/`))
    .toSorted((left, right) => right.href.length - left.href.length);
  return matches[0]?.id ?? null;
}

export function navSeenIdForHref(href: string): string | null {
  return NAV_SEEN_SURFACES.find((surface) => surface.href === href && !surface.alsoShowOn)?.id ?? null;
}

export function displayedUnreadIds(unreadIds: readonly string[]): string[] {
  const shown = new Set(unreadIds);
  for (const surface of NAV_SEEN_SURFACES) {
    if (surface.alsoShowOn && shown.has(surface.id)) shown.add(surface.alsoShowOn);
  }
  return [...shown];
}

export function toyBoxHasUnread(unreadIds: readonly string[]): boolean {
  return unreadIds.some((id) => id !== "patches");
}

export function readNavForce(storage: Pick<Storage, "getItem">): NavForceMap {
  try {
    const raw = storage.getItem(navForceStorageKey());
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const force: NavForceMap = {};
    for (const surface of NAV_SEEN_SURFACES) {
      const value = parsed[surface.id];
      if (value === true || value === false) force[surface.id] = value;
    }
    return force;
  } catch {
    return {};
  }
}

export function writeNavForce(storage: Pick<Storage, "setItem">, force: NavForceMap): void {
  storage.setItem(navForceStorageKey(), JSON.stringify(force));
}

export function effectiveUnreadIds(realIds: readonly string[], force: NavForceMap): string[] {
  const ids = new Set(realIds);
  for (const surface of NAV_SEEN_SURFACES) {
    if (force[surface.id] === true) ids.add(surface.id);
    if (force[surface.id] === false) ids.delete(surface.id);
  }
  return displayedUnreadIds([...ids]);
}

type UnreadCache = { at: number; stamp: string; ids: string[] };

function unreadCacheKey(): string {
  return `${UNREAD_CACHE_PREFIX}${supabaseEnv}`;
}

export function seenStamp(seen: NavSeenMap): string {
  return NAV_SEEN_SURFACES.map((surface) => seen[surface.id] ?? "").join("|");
}

export function readUnreadCache(
  storage: Pick<Storage, "getItem">,
  stamp: string,
  now = Date.now(),
): string[] | null {
  try {
    const raw = storage.getItem(unreadCacheKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UnreadCache>;
    if (parsed.stamp !== stamp || typeof parsed.at !== "number" || now - parsed.at > UNREAD_CACHE_MS) return null;
    return Array.isArray(parsed.ids) ? parsed.ids.filter((id) => typeof id === "string") : null;
  } catch {
    return null;
  }
}

export function writeUnreadCache(storage: Pick<Storage, "setItem">, stamp: string, ids: readonly string[], now = Date.now()): void {
  try {
    const payload: UnreadCache = { at: now, stamp, ids: [...ids] };
    storage.setItem(unreadCacheKey(), JSON.stringify(payload));
  } catch {
    // Private browsing can reject sessionStorage.
  }
}

async function surfaceHasNewer(surface: NavSeenSurface, since: string): Promise<boolean> {
  let query = supabase
    .from(surface.table)
    .select("created_at")
    .eq("env", supabaseEnv)
    .gt("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1);
  if (surface.storyLikes?.length) {
    const filter = surface.storyLikes.map((pattern) => `story_id.like.${pattern}`).join(",");
    query = query.or(filter);
  }
  const { data, error } = await withSupabaseTimeout(
    `nav-seen.${surface.id}`,
    query,
  );
  if (error) return false;
  return (data?.length ?? 0) > 0;
}

export async function fetchUnreadSurfaceIds(seen: NavSeenMap): Promise<string[]> {
  if (!supabaseEnabled) return [];
  const flags = await Promise.all(NAV_SEEN_SURFACES.map(async (surface) => {
    const since = seen[surface.id];
    if (!since) return null;
    return await surfaceHasNewer(surface, since) ? surface.id : null;
  }));
  return flags.filter((id): id is string => id !== null);
}

export function publishNavSeen(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(NAV_SEEN_EVENT));
}
