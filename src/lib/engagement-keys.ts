/**
 * Keys and limits of the comments group API (docs/supabase-exit/STEP1_DESIGN.md 9.1).
 * No imports: the Worker and every client bundle share these checks, so a key
 * the Worker would refuse is read on the legacy path instead of failing.
 */

/** Every thread key in both envs on 2026-11-06 uses only these characters. */
const THREAD_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
const REACTION_TYPE = /^[a-z_-]{1,32}$/;
const REACTION_ID = /^[A-Za-z0-9._-]{1,128}$/;
const REACTION_VERSION = /^[A-Za-z0-9._-]{1,32}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ENGAGEMENT_LIMITS = {
  threads: 64,
  likes: 16,
  reactions: 64,
  philosophers: 4,
} as const;

export type EngagementPart = keyof typeof ENGAGEMENT_LIMITS;

export const ENGAGEMENT_PARTS: readonly EngagementPart[] = ["threads", "likes", "reactions", "philosophers"];

/** Personal overlays read these three. */
export const ENGAGEMENT_ME_PARTS: readonly EngagementPart[] = ["threads", "likes", "reactions"];

/** Whole query string cap, so batches stay far from URL limits. */
export const ENGAGEMENT_QUERY_MAX_CHARS = 6000;

export const PHILOSOPHER_POSTS_PER_RESOURCE = 20;

export const REACTION_KINDS = ["buff", "nerf", "rework"] as const;
export type ReactionKind = (typeof REACTION_KINDS)[number];

export type ReactionCounts = { buff: number; nerf: number; rework: number };

export type ReactionTarget = { resourceType: string; resourceId: string; gameVersion: string };

export function isThreadKey(value: string): boolean {
  return THREAD_KEY.test(value);
}

export function isReactionKind(value: unknown): value is ReactionKind {
  return typeof value === "string" && (REACTION_KINDS as readonly string[]).includes(value);
}

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

export function isReactionTarget(target: ReactionTarget): boolean {
  return REACTION_TYPE.test(target.resourceType)
    && REACTION_ID.test(target.resourceId)
    && REACTION_VERSION.test(target.gameVersion);
}

export function reactionTargetKey(target: ReactionTarget): string {
  return `${target.resourceType}:${target.resourceId}:${target.gameVersion}`;
}

export function parseReactionTargetKey(value: string): ReactionTarget | null {
  const parts = value.split(":");
  if (parts.length !== 3) return null;
  const target = { resourceType: parts[0], resourceId: parts[1], gameVersion: parts[2] };
  return isReactionTarget(target) ? target : null;
}

export type PhilosopherResource = { resourceType: string; resourceId: string };

export function philosopherResourceKey(resource: PhilosopherResource): string {
  return `${resource.resourceType}:${resource.resourceId}`;
}

export function parsePhilosopherResourceKey(value: string): PhilosopherResource | null {
  const parts = value.split(":");
  if (parts.length !== 2) return null;
  if (!REACTION_TYPE.test(parts[0]) || !REACTION_ID.test(parts[1])) return null;
  return { resourceType: parts[0], resourceId: parts[1] };
}

export function isPhilosopherResource(resource: PhilosopherResource): boolean {
  return parsePhilosopherResourceKey(philosopherResourceKey(resource)) !== null;
}

/** True when `value` is a valid entry of `part`. */
export function isEngagementEntry(part: EngagementPart, value: string): boolean {
  if (part === "threads" || part === "likes") return isThreadKey(value);
  if (part === "reactions") return parseReactionTargetKey(value) !== null;
  return parsePhilosopherResourceKey(value) !== null;
}

/** Parses one `,`-joined list; null when any entry is invalid, repeated, or over the cap. */
export function parseEngagementList(part: EngagementPart, value: string): string[] | null {
  if (!value) return null;
  const entries = value.split(",");
  if (entries.length > ENGAGEMENT_LIMITS[part]) return null;
  if (new Set(entries).size !== entries.length) return null;
  return entries.every((entry) => isEngagementEntry(part, entry)) ? entries : null;
}

/** The reply thread of one colorful philosophers post (same as colorful-philosophers.ts). */
export function philosopherReplyThreadKey(postId: string): string {
  return `colorful-philosophers:${postId}`;
}
