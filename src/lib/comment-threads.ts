import {
  buildCompendiumResourceDetailHref,
  isCompendiumResourceLinkType,
} from "@/lib/compendium-resource-links";

const COMMENTS_ANCHOR = "#comments";

export function buildPatchCommentThreadKey(version: string): string {
  return `sts2-patch:${version}`;
}

export function buildCodexCommentThreadKey(entityType: string, entityId: string): string {
  return `sts2-codex:${entityType}:${entityId}`;
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

function prefixedResourceCommentsHref(storyId: string, prefix: string, pathname: string): string | null {
  if (!storyId.startsWith(prefix)) return null;
  const id = storyId.slice(prefix.length);
  if (!id) return null;
  return `${pathname}/${encodeURIComponent(id)}${COMMENTS_ANCHOR}`;
}

export function commentThreadHref(storyId: string): string {
  const patchHref = prefixedResourceCommentsHref(storyId, "sts2-patch:", "/patches");
  if (patchHref) return patchHref;

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
    ?? (storyId === "byrdispatch" ? `/byrdispatch${COMMENTS_ANCHOR}` : `/#${storyId}`);
}
