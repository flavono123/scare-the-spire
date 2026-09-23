import sts2Meta from "../../data/sts2/meta.json";
import { buildCompendiumResourceDetailHref, isCompendiumResourceLinkType } from "@/lib/compendium-resource-links";

export const DEBATE_CYCLES_TABLE = "debate_cycles";

export const DEBATE_GAME_VERSION = sts2Meta.version;

/** Monday of the first card week. Later weeks rotate from this date. */
export const DEBATE_WEEK_EPOCH = "2026-09-21";

/** Large catalogs stay locked to their own week. Counts are the compendium index. */
export const DEBATE_FIXED_POOLS = ["card", "relic", "monster", "power"] as const;

/** Small catalogs share one week and are not filtered to a single type. */
export const DEBATE_MIXED_TYPES = ["character", "ancient", "enchantment", "affliction"] as const;

export const DEBATE_POOLS = [...DEBATE_FIXED_POOLS, "mixed"] as const;

export const DEBATE_RESOURCE_TYPES = [
  ...DEBATE_FIXED_POOLS,
  ...DEBATE_MIXED_TYPES,
] as const;

export const DEBATE_SCHEDULE_WEEKS = 8;

export type DebatePool = (typeof DEBATE_POOLS)[number];
export type DebateResourceType = (typeof DEBATE_RESOURCE_TYPES)[number];

export interface DebateSubject {
  id: string;
  resourceType: DebateResourceType;
  resourceId: string;
  nameKo: string;
  nameEn: string;
  imageUrl: string | null;
  href: string;
  gameVersion: string;
  openedAt: string;
  weekStart: string;
  pool: DebatePool;
}

export interface DebateWeekSlot {
  weekStart: string;
  weekEnd: string;
  pool: DebatePool;
}

export function isDebateResourceType(value: string): value is DebateResourceType {
  return (DEBATE_RESOURCE_TYPES as readonly string[]).includes(value);
}

export function isDebatePool(value: string): value is DebatePool {
  return (DEBATE_POOLS as readonly string[]).includes(value);
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

export function parseDebateDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = utcDate(Number(match[1]), Number(match[2]), Number(match[3]));
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return date;
}

export function formatDebateDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDebateDays(value: string, days: number): string | null {
  const date = parseDebateDate(value);
  if (!date) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return formatDebateDate(date);
}

/** Monday calendar date in KST. */
export function debateWeekStart(now = new Date()): string {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const mondayOffset = (kst.getUTCDay() + 6) % 7;
  return formatDebateDate(utcDate(
    kst.getUTCFullYear(),
    kst.getUTCMonth() + 1,
    kst.getUTCDate() - mondayOffset,
  ));
}

export function isDebateMonday(value: string): boolean {
  const date = parseDebateDate(value);
  return Boolean(date && date.getUTCDay() === 1);
}

export function debatePoolForWeek(weekStart: string): DebatePool | null {
  const start = parseDebateDate(weekStart);
  const epoch = parseDebateDate(DEBATE_WEEK_EPOCH);
  if (!start || !epoch || start.getUTCDay() !== 1) return null;
  const weeks = Math.round((start.getTime() - epoch.getTime()) / (7 * 24 * 60 * 60 * 1000));
  const index = ((weeks % DEBATE_POOLS.length) + DEBATE_POOLS.length) % DEBATE_POOLS.length;
  return DEBATE_POOLS[index] ?? null;
}

export function debatePoolAllows(pool: DebatePool, resourceType: string): boolean {
  if (pool === "mixed") {
    return (DEBATE_MIXED_TYPES as readonly string[]).includes(resourceType);
  }
  return resourceType === pool;
}

export function upcomingDebateWeeks(count = DEBATE_SCHEDULE_WEEKS, now = new Date()): DebateWeekSlot[] {
  const start = debateWeekStart(now);
  return Array.from({ length: count }, (_, index) => {
    const weekStart = addDebateDays(start, index * 7) ?? start;
    const weekEnd = addDebateDays(weekStart, 6) ?? weekStart;
    return {
      weekStart,
      weekEnd,
      pool: debatePoolForWeek(weekStart) ?? "card",
    };
  });
}

export function debateSubjectHref(resourceType: string, resourceId: string): string | null {
  if (!isDebateResourceType(resourceType) || !isCompendiumResourceLinkType(resourceType)) return null;
  const id = resourceId.trim();
  if (!id) return null;
  return buildCompendiumResourceDetailHref(resourceType, id);
}

export function debateSubjectFromRow(row: {
  id?: unknown;
  resource_type?: unknown;
  resource_id?: unknown;
  name_ko?: unknown;
  name_en?: unknown;
  image_url?: unknown;
  href?: unknown;
  game_version?: unknown;
  opened_at?: unknown;
  week_start?: unknown;
  pool?: unknown;
}): DebateSubject | null {
  if (typeof row.resource_type !== "string" || !isDebateResourceType(row.resource_type)) return null;
  if (typeof row.resource_id !== "string" || !row.resource_id.trim()) return null;
  if (typeof row.name_ko !== "string" || !row.name_ko.trim()) return null;
  if (typeof row.name_en !== "string" || !row.name_en.trim()) return null;
  if (typeof row.href !== "string" || !row.href.startsWith("/compendium/")) return null;
  if (typeof row.game_version !== "string" || !row.game_version.trim()) return null;
  if (typeof row.opened_at !== "string" || !row.opened_at) return null;
  if (typeof row.id !== "string" || !row.id) return null;
  if (typeof row.week_start !== "string" || !isDebateMonday(row.week_start)) return null;
  if (typeof row.pool !== "string" || !isDebatePool(row.pool)) return null;
  if (!debatePoolAllows(row.pool, row.resource_type)) return null;

  return {
    id: row.id,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    nameKo: row.name_ko,
    nameEn: row.name_en,
    imageUrl: typeof row.image_url === "string" && row.image_url ? row.image_url : null,
    href: row.href,
    gameVersion: row.game_version,
    openedAt: row.opened_at,
    weekStart: row.week_start,
    pool: row.pool,
  };
}

export function isMissingDebateCyclesTable(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error) return false;
  if (error.code === "PGRST205" || error.code === "42P01") return true;
  return /debate_cycles/i.test(error.message ?? "");
}
