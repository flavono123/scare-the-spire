import {
  COLORFUL_PHILOSOPHERS_HREF,
  COLORFUL_PHILOSOPHERS_POSTS_TABLE,
} from "@/lib/colorful-philosophers";
import { dataEnv } from "@/lib/data-env";
import { FAVORITE_TOURNAMENT_HREF } from "@/lib/favorite-tournament";
import { stripGameLocaleFromPath } from "@/lib/i18n";
import { PAGESTORM_HREF } from "@/lib/pagestorm";
import { loadNavSnapshot, snapshotHasSurface, type NavSnapshot } from "@/lib/nav-snapshot";
import { weeklyPublishedAt } from "@/lib/nav-surfaces";
import patchesJson from "../../data/sts2-patches.json";
import neowslettersJson from "../../data/sts2-neowsletters.json";

const PATCH_NOTE_TIMES = (patchesJson as { date: string }[]).map((patch) => `${patch.date}T12:00:00.000Z`);
const NEOWSLETTER_ADDED_TIMES = (neowslettersJson as { addedAt: string }[]).map((issue) => issue.addedAt);

export function contentIsNewerThanSeen(publishedAt: string, seenAt: string): boolean {
  return publishedAt > seenAt;
}

/**
 * A future-dated entry (such as a placeholder shell for an upcoming patch) is
 * always later than any visit, so it would keep the dot lit after every read.
 * Only entries whose time has already come count.
 */
export function catalogHasNewer(
  publishedTimes: readonly string[],
  seenAt: string,
  now = new Date().toISOString(),
): boolean {
  return publishedTimes.some((publishedAt) => publishedAt <= now && contentIsNewerThanSeen(publishedAt, seenAt));
}

export const NAV_SEEN_EVENT = "sts-nav-seen";

const STORAGE_PREFIX = "sts-nav-seen:";
/** Toy Box index visits dismiss only the menu dot; post visits still move `seen`. */
const MENU_SEEN_PREFIX = "sts-nav-menu-seen:";
// Bumped to drop the dev chips' forced marks (v1 "sts-nav-force:", then v2
// on 2026-11-06 once testing was done).
const FORCE_PREFIX = "sts-nav-force-v3:";
const UNREAD_CACHE_PREFIX = "sts-nav-unread:";
const UNREAD_CACHE_MS = 60_000;

export type NavSeenSurface = {
  id: string;
  href: string;
  label: string;
  table?: "combo_posts" | "transfigure_posts" | "this_or_that_posts" | "favorite_tournament_posts" | "chemical_posts" | "decisions_decisions_posts" | "pagestorm_posts" | "runs";
  catalog?: "patch-notes" | "neowsletters";
  /** Posts reserved ahead and published at a week's Monday 00:00 KST. */
  weekly?: typeof COLORFUL_PHILOSOPHERS_POSTS_TABLE;
  /** Lights for browsers that have never visited, instead of starting from now. */
  unseenByDefault?: boolean;
  /** Menu row that should also light when this surface is unread. */
  alsoShowOn?: string;
};

export const NAV_SEEN_SURFACES: readonly NavSeenSurface[] = [
  { id: "patch-notes", href: "/patches", label: "패치 노트", catalog: "patch-notes" },
  { id: "neowsletters", href: "/patches/neowsletters", label: "니오우스레터", catalog: "neowsletters" },
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
  {
    id: "colorful-philosophers",
    href: COLORFUL_PHILOSOPHERS_HREF,
    label: "다채로운 철학자들",
    weekly: COLORFUL_PHILOSOPHERS_POSTS_TABLE,
    unseenByDefault: true,
  },
];

const NEVER_SEEN_AT = "1970-01-01T00:00:00.000Z";

export type NavSeenMap = Record<string, string>;
export type NavForceMap = Record<string, boolean>;

export function navSeenStorageKey(env = dataEnv): string {
  return `${STORAGE_PREFIX}${env}`;
}

export function navMenuSeenStorageKey(env = dataEnv): string {
  return `${MENU_SEEN_PREFIX}${env}`;
}

export function navForceStorageKey(env = dataEnv): string {
  return `${FORCE_PREFIX}${env}`;
}

function emptySeen(now: string): NavSeenMap {
  return Object.fromEntries(NAV_SEEN_SURFACES.map((surface) => [
    surface.id,
    surface.unseenByDefault ? NEVER_SEEN_AT : now,
  ]));
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

export function readNavMenuSeen(storage: Pick<Storage, "getItem">): NavSeenMap {
  try {
    const raw = storage.getItem(navMenuSeenStorageKey());
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const menuSeen: NavSeenMap = {};
    for (const surface of NAV_SEEN_SURFACES) {
      const value = parsed[surface.id];
      if (typeof value === "string" && value.length > 0) menuSeen[surface.id] = value;
    }
    return menuSeen;
  } catch {
    return {};
  }
}

/** Menu dots compare against the later of the post-read time and the index-dismiss time. */
export function menuUnreadSince(seen: NavSeenMap, menuSeen: NavSeenMap): NavSeenMap {
  const since: NavSeenMap = { ...seen };
  for (const [id, at] of Object.entries(menuSeen)) {
    if (!since[id] || at > since[id]) since[id] = at;
  }
  return since;
}

export function readMenuUnreadSince(storage: Pick<Storage, "getItem" | "setItem">): NavSeenMap {
  return menuUnreadSince(readNavSeen(storage), readNavMenuSeen(storage));
}

/** Records a visit: a post marks its surface read; a Toy Box index only clears its menu dot. */
export function markNavVisit(
  storage: Pick<Storage, "getItem" | "setItem">,
  pathname: string,
  now = new Date().toISOString(),
): string | null {
  const surfaceId = surfaceIdForPath(pathname);
  const surface = NAV_SEEN_SURFACES.find((item) => item.id === surfaceId);
  if (!surface) return null;
  const onIndex = stripGameLocaleFromPath(pathname) === surface.href;
  try {
    if (!onIndex) {
      const seen = readNavSeen(storage, now);
      seen[surface.id] = now;
      writeNavSeen(storage, seen);
    } else if (!surface.catalog) {
      const menuSeen = readNavMenuSeen(storage);
      for (const item of NAV_SEEN_SURFACES) {
        if (item.id === surface.id || item.alsoShowOn === surface.id) menuSeen[item.id] = now;
      }
      storage.setItem(navMenuSeenStorageKey(), JSON.stringify(menuSeen));
    }
  } catch {
    // Storage can be blocked; the dots just stay as they were.
  }
  return surface.id;
}

export function surfaceIdForPath(pathname: string): string | null {
  const path = stripGameLocaleFromPath(pathname);
  if (path === "/patches/changes" || path.startsWith("/patches/changes/")) return null;
  const matches = NAV_SEEN_SURFACES
    .filter((surface) => path === surface.href || path.startsWith(`${surface.href}/`))
    .toSorted((left, right) => right.href.length - left.href.length);
  return matches[0]?.id ?? null;
}

export function topBarPatchUnread(unreadIds: readonly string[]): boolean {
  return unreadIds.includes("patch-notes") || unreadIds.includes("neowsletters");
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
  return unreadIds.some((id) => id !== "patch-notes" && id !== "neowsletters");
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
  return `${UNREAD_CACHE_PREFIX}${dataEnv}`;
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

function catalogTimes(surface: NavSeenSurface): readonly string[] {
  if (surface.catalog === "patch-notes") return PATCH_NOTE_TIMES;
  if (surface.catalog === "neowsletters") return NEOWSLETTER_ADDED_TIMES;
  return [];
}

/**
 * Unread ids from the Worker's nav snapshot: the same answer as the former
 * per-surface queries (`created_at > since` exists iff the latest one is newer).
 * Catalog surfaces never need the network. `snapshot` null means the API was
 * unavailable or its snapshot was refused: only catalog dots remain. A table
 * surface the snapshot does not list stays dark (the Worker lists them all).
 */
export async function unreadFromSnapshot(seen: NavSeenMap, snapshot: NavSnapshot | null): Promise<string[]> {
  return NAV_SEEN_SURFACES.flatMap((surface) => {
    const since = seen[surface.id];
    if (!since) return [];
    let hasNewer = false;
    if (surface.catalog) {
      hasNewer = catalogHasNewer(catalogTimes(surface), since);
    } else if (!snapshot) {
      hasNewer = false;
    } else if (surface.weekly) {
      const weekStart = snapshot.weekly["colorful-philosophers"];
      hasNewer = typeof weekStart === "string" && contentIsNewerThanSeen(weeklyPublishedAt(weekStart), since);
    } else if (snapshotHasSurface(snapshot, surface.id)) {
      const latest = snapshot.latest[surface.id];
      hasNewer = typeof latest === "string" && contentIsNewerThanSeen(latest, since);
    }
    return hasNewer ? [surface.id] : [];
  });
}

/**
 * Never rejects. The shared snapshot promise may also come from the patch static
 * client, which rejects with its own error; any rejection is an outage here.
 */
export async function fetchUnreadSurfaceIds(seen: NavSeenMap): Promise<string[]> {
  const snapshot = await loadNavSnapshot().catch(() => null);
  return unreadFromSnapshot(seen, snapshot);
}

export function publishNavSeen(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(NAV_SEEN_EVENT));
}
