import sts2Meta from "../../data/sts2/meta.json";
import {
  buildCompendiumResourceDetailHref,
  isCompendiumResourceLinkType,
} from "@/lib/compendium-resource-links";
import { localizeHref, type ServiceLocale } from "@/lib/i18n";

export const COLORFUL_PHILOSOPHERS_HREF = "/colorful-philosophers";
export const COLORFUL_PHILOSOPHERS_TOKEN_SRC = "/images/sts2/modifiers/draft.webp";
export const COLORFUL_PHILOSOPHERS_BACKGROUND_SRC = "/images/sts2/events/colorful_philosophers.webp";
export const COLORFUL_PHILOSOPHERS_POSTS_TABLE = "colorful_philosopher_posts";
export const COLORFUL_PHILOSOPHERS_REACTIONS_TABLE = "colorful_philosopher_reactions";
export const COLORFUL_PHILOSOPHERS_GAME_VERSION = sts2Meta.version;
export const COLORFUL_PHILOSOPHERS_SCHEDULE_WEEKS = 8;

export const COLORFUL_PHILOSOPHERS_EPOCH = "2026-09-21";
export const COLORFUL_PHILOSOPHER_SLOTS = ["topic", "card", "relic"] as const;
export const COLORFUL_PHILOSOPHER_LEGACY_SLOTS = ["power"] as const;
export type ColorfulPhilosopherSlot =
  | (typeof COLORFUL_PHILOSOPHER_SLOTS)[number]
  | (typeof COLORFUL_PHILOSOPHER_LEGACY_SLOTS)[number];

export const COLORFUL_PHILOSOPHER_REACTIONS = ["buff", "nerf", "rework"] as const;
export type ColorfulPhilosopherReaction = (typeof COLORFUL_PHILOSOPHER_REACTIONS)[number];

export const COLORFUL_PHILOSOPHER_REACTION_TOKENS: Record<
  ColorfulPhilosopherReaction,
  { src: string; variant: "green" | "red" | "pink" }
> = {
  buff: { src: "/images/sts2/powers/dexterity_power.webp", variant: "green" },
  nerf: { src: "/images/sts2/powers/vulnerable_power.webp", variant: "red" },
  rework: { src: "/images/sts2/relics/touch_of_orobas.webp", variant: "pink" },
};

export interface ColorfulPhilosopherPost {
  id: string;
  weekStart: string;
  slot: ColorfulPhilosopherSlot;
  resourceType: string;
  resourceId: string;
  nameKo: string;
  nameEn: string;
  imageUrl: string | null;
  body: string;
  gameVersion: string;
  buffCount: number;
  nerfCount: number;
  reworkCount: number;
}

export function colorfulPhilosophersCommentThreadKey(postId: string): string {
  return `colorful-philosophers:${postId}`;
}

export function colorfulPhilosopherReactionStorageKey(postId: string): string {
  return `sts-cp-reaction:${postId}`;
}

export function isColorfulPhilosopherSlot(value: string): value is ColorfulPhilosopherSlot {
  return (COLORFUL_PHILOSOPHER_SLOTS as readonly string[]).includes(value)
    || (COLORFUL_PHILOSOPHER_LEGACY_SLOTS as readonly string[]).includes(value);
}

export function colorfulPhilosophersWeekNumber(weekStart: string): number {
  const epoch = Date.parse(`${COLORFUL_PHILOSOPHERS_EPOCH}T00:00:00Z`);
  const start = Date.parse(`${weekStart}T00:00:00Z`);
  if (!Number.isFinite(epoch) || !Number.isFinite(start)) return 1;
  return Math.floor((start - epoch) / (7 * 24 * 60 * 60 * 1000)) + 1;
}

export function isColorfulPhilosopherReaction(value: string): value is ColorfulPhilosopherReaction {
  return (COLORFUL_PHILOSOPHER_REACTIONS as readonly string[]).includes(value);
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function colorfulPhilosophersWeekStart(now = new Date()): string {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const mondayOffset = (kst.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(
    kst.getUTCFullYear(),
    kst.getUTCMonth(),
    kst.getUTCDate() - mondayOffset,
  ));
  return monday.toISOString().slice(0, 10);
}

export function addColorfulPhilosophersDays(value: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function isColorfulPhilosophersMonday(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value && date.getUTCDay() === 1;
}

export function upcomingColorfulPhilosopherWeeks(now = new Date()): string[] {
  const start = colorfulPhilosophersWeekStart(now);
  return Array.from({ length: COLORFUL_PHILOSOPHERS_SCHEDULE_WEEKS }, (_, index) => (
    addColorfulPhilosophersDays(start, index * 7)
  ));
}

const REEL_SLOT_ORDER: readonly ColorfulPhilosopherSlot[] = [
  ...COLORFUL_PHILOSOPHER_SLOTS,
  ...COLORFUL_PHILOSOPHER_LEGACY_SLOTS,
];

/** The newest published week (not after `currentWeek`), in slot order. */
export function colorfulPhilosophersReelPosts(
  posts: readonly ColorfulPhilosopherPost[],
  currentWeek = colorfulPhilosophersWeekStart(),
): ColorfulPhilosopherPost[] {
  const published = posts.filter((post) => post.weekStart <= currentWeek);
  const week = published.reduce<string | null>(
    (latest, post) => (!latest || post.weekStart > latest ? post.weekStart : latest),
    null,
  );
  if (!week) return [];
  return published
    .filter((post) => post.weekStart === week)
    .sort((left, right) => REEL_SLOT_ORDER.indexOf(left.slot) - REEL_SLOT_ORDER.indexOf(right.slot));
}

export function colorfulPhilosopherSubjectHref(
  post: Pick<ColorfulPhilosopherPost, "resourceType" | "resourceId">,
  serviceLocale: ServiceLocale,
): string | null {
  if (!isCompendiumResourceLinkType(post.resourceType)) return null;
  return localizeHref(buildCompendiumResourceDetailHref(post.resourceType, post.resourceId), serviceLocale);
}

export function colorfulPhilosopherPostFromRow(row: {
  id?: unknown;
  week_start?: unknown;
  slot?: unknown;
  resource_type?: unknown;
  resource_id?: unknown;
  name_ko?: unknown;
  name_en?: unknown;
  image_url?: unknown;
  body?: unknown;
  game_version?: unknown;
  buff_count?: unknown;
  nerf_count?: unknown;
  rework_count?: unknown;
}): ColorfulPhilosopherPost | null {
  if (typeof row.id !== "string" || !row.id) return null;
  if (typeof row.week_start !== "string") return null;
  const weekStart = row.week_start.slice(0, 10);
  if (!isColorfulPhilosophersMonday(weekStart)) return null;
  if (typeof row.slot !== "string" || !isColorfulPhilosopherSlot(row.slot)) return null;
  if (typeof row.resource_id !== "string" || !row.resource_id) return null;
  if (typeof row.name_ko !== "string" || !row.name_ko) return null;
  if (typeof row.name_en !== "string" || !row.name_en) return null;
  if (typeof row.body !== "string" || !row.body.trim()) return null;
  if (typeof row.game_version !== "string" || !row.game_version) return null;
  return {
    id: row.id,
    weekStart,
    slot: row.slot,
    resourceType: typeof row.resource_type === "string" && row.resource_type ? row.resource_type : row.slot,
    resourceId: row.resource_id,
    nameKo: row.name_ko,
    nameEn: row.name_en,
    imageUrl: typeof row.image_url === "string" && row.image_url ? row.image_url : null,
    body: row.body,
    gameVersion: row.game_version,
    buffCount: typeof row.buff_count === "number" ? row.buff_count : 0,
    nerfCount: typeof row.nerf_count === "number" ? row.nerf_count : 0,
    reworkCount: typeof row.rework_count === "number" ? row.rework_count : 0,
  };
}

export function isMissingColorfulPhilosopherPosts(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error) return false;
  if (error.code === "PGRST205" || error.code === "42P01" || error.code === "42703") return true;
  return /colorful_philosopher_posts/i.test(error.message ?? "");
}
