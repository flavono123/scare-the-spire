import {
  buildCompendiumResourceDetailHref,
  isCompendiumResourceLinkType,
} from "@/lib/compendium-resource-links";
import { sts1DetailPath } from "@/lib/sts1/paths";
import type { Sts1ResourceType } from "@/lib/sts1/types";

const COMMENTS_ANCHOR = "#comments";

export const STS1_COMMENT_RESOURCE_TYPES = ["card", "relic", "potion"] as const;

export type Sts1CommentResourceType = (typeof STS1_COMMENT_RESOURCE_TYPES)[number];

const STS1_COMMENT_RESOURCE_PATHS: Record<Sts1CommentResourceType, Sts1ResourceType> = {
  card: "cards",
  relic: "relics",
  potion: "potions",
};

function isSts1CommentResourceType(value: string): value is Sts1CommentResourceType {
  return STS1_COMMENT_RESOURCE_TYPES.includes(value as Sts1CommentResourceType);
}

export function buildPatchCommentThreadKey(version: string): string {
  return `sts2-patch:${version}`;
}

export function buildCodexCommentThreadKey(entityType: string, entityId: string): string {
  return `sts2-codex:${entityType}:${entityId}`;
}

export function buildSts1CommentThreadKey(
  resourceType: Sts1CommentResourceType,
  slug: string,
): string {
  return `sts1-codex:${resourceType}:${slug}`;
}

export function buildByrdispatchCommentThreadKey(): string {
  return "byrdispatch";
}

export function buildComboCommentThreadKey(postId: string): string {
  return `c-c-c-combo:${postId}`;
}

export function buildTransfigureCommentThreadKey(postId: string): string {
  return `transfigure:${postId}`;
}

export function buildThisOrThatCommentThreadKey(postId: string): string {
  return `this-or-that:${postId}`;
}

export function buildChemicalXCommentThreadKey(postId: string): string {
  return `chemical-x:${postId}`;
}

export function buildDefragmentCommentThreadKey(postId: string): string {
  return `defragment:${postId}`;
}

export function buildDecisionsDecisionsCommentThreadKey(postId: string): string {
  return `decisions-decisions:${postId}`;
}

export function buildFavoriteTournamentCommentThreadKey(postId: string): string {
  return `favorite-tournament:${postId}`;
}

export function buildPagestormCommentThreadKey(postId: string): string {
  return `pagestorm:${postId}`;
}

export function buildHistoryCourseCommentThreadKey(runId: string): string {
  return `history-course:${runId}`;
}

export const COMMENT_THREAD_SERVICES = [
  "patches",
  "compendium",
  "byrdispatch",
  "combo",
  "transfigure",
  "this_or_that",
  "chemical_x",
  "defragment",
  "decisions_decisions",
  "favorite_tournament",
  "pagestorm",
  "stories",
  "other",
] as const;

export type CommentThreadService = (typeof COMMENT_THREAD_SERVICES)[number];

/** Keep in sync with `public.admin_story_service`. */
export function commentThreadService(storyId: string): CommentThreadService {
  if (storyId.startsWith("sts2-patch:")) return "patches";
  if (storyId.startsWith("sts2-codex:") || storyId.startsWith("sts1-codex:")) return "compendium";
  if (storyId === "byrdispatch") return "byrdispatch";
  if (storyId.startsWith("c-c-c-combo:")) return "combo";
  if (storyId.startsWith("transfigure:")) return "transfigure";
  if (storyId.startsWith("this-or-that:")) return "this_or_that";
  if (storyId.startsWith("chemical-x:")) return "chemical_x";
  if (storyId.startsWith("defragment:")) return "defragment";
  if (storyId.startsWith("decisions-decisions:")) return "decisions_decisions";
  if (storyId.startsWith("favorite-tournament:")) return "favorite_tournament";
  if (storyId.startsWith("pagestorm:")) return "pagestorm";
  if (storyId.startsWith("community:")) return "stories";
  return "other";
}

export const COMMENT_THREAD_SERVICE_PREFIX: Record<
  Exclude<CommentThreadService, "byrdispatch" | "other">,
  string
> = {
  patches: "sts2-patch:",
  compendium: "sts2-codex:",
  combo: "c-c-c-combo:",
  transfigure: "transfigure:",
  this_or_that: "this-or-that:",
  chemical_x: "chemical-x:",
  defragment: "defragment:",
  decisions_decisions: "decisions-decisions:",
  favorite_tournament: "favorite-tournament:",
  pagestorm: "pagestorm:",
  stories: "community:",
};

function prefixedResourceCommentsHref(storyId: string, prefix: string, pathname: string): string | null {
  if (!storyId.startsWith(prefix)) return null;
  const id = storyId.slice(prefix.length);
  if (!id) return null;
  return `${pathname}/${encodeURIComponent(id)}${COMMENTS_ANCHOR}`;
}

export function commentThreadHref(storyId: string): string {
  const patchHref = prefixedResourceCommentsHref(storyId, "sts2-patch:", "/patches");
  if (patchHref) return patchHref;

  const sts1Match = /^sts1-codex:([^:]+):(.+)$/.exec(storyId);
  if (sts1Match) {
    const [, type, slug] = sts1Match;
    if (isSts1CommentResourceType(type) && slug) {
      return `${sts1DetailPath(STS1_COMMENT_RESOURCE_PATHS[type], encodeURIComponent(slug))}${COMMENTS_ANCHOR}`;
    }
  }

  const codexMatch = /^sts2-codex:([^:]+):(.+)$/.exec(storyId);
  if (codexMatch) {
    const [, type, id] = codexMatch;
    if (isCompendiumResourceLinkType(type)) {
      return `${buildCompendiumResourceDetailHref(type, id)}${COMMENTS_ANCHOR}`;
    }
  }

  return prefixedResourceCommentsHref(storyId, "this-or-that:", "/this-or-that")
    ?? prefixedResourceCommentsHref(storyId, "c-c-c-combo:", "/c-c-c-combo")
    ?? prefixedResourceCommentsHref(storyId, "transfigure:", "/transfigure")
    ?? prefixedResourceCommentsHref(storyId, "chemical-x:", "/chemical-x")
    ?? prefixedResourceCommentsHref(storyId, "defragment:", "/defragment")
    ?? prefixedResourceCommentsHref(storyId, "decisions-decisions:", "/decisions-decisions")
    ?? prefixedResourceCommentsHref(storyId, "favorite-tournament:", "/this-or-that/tournament")
    ?? prefixedResourceCommentsHref(storyId, "pagestorm:", "/pagestorm")
    ?? prefixedResourceCommentsHref(storyId, "history-course:", "/history-course")
    ?? (storyId === "byrdispatch" ? `/byrdispatch${COMMENTS_ANCHOR}` : `/#${storyId}`);
}
