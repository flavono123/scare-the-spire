import type { EntityInfo } from "@/components/patch-note-renderer";
import {
  entityKeywordDescription,
  matchEntities,
  normalizeKeywordLookupKey,
} from "@/lib/chemical-utils";

/**
 * Pagestorm reference grammar, shared by typed commits and the `{` menu.
 *
 *   name
 *   name#1
 *   name@version          reserved, not resolved
 *   name#1@version        reserved, not resolved
 *
 * `#1` marks Slay the Spire 1. `@` plus a dotted number is reserved for a
 * later version pin (`예비@0.99.1`) so the two suffixes do not collide.
 * A version suffix is recognized and then left as text until that pin exists.
 */
export type PagestormReferenceGame = "sts1" | "sts2";

export type PagestormReferenceQuery = {
  name: string;
  game: PagestormReferenceGame;
  version: string | null;
};

const REFERENCE_PATTERN = /^(.+?)(#1)?(?:@(\d+(?:\.\d+)*))?$/;

export function parsePagestormReferenceQuery(raw: string): PagestormReferenceQuery {
  const trimmed = raw.trim();
  const match = REFERENCE_PATTERN.exec(trimmed);
  if (!match) return { name: trimmed, game: "sts2", version: null };
  return {
    name: (match[1] ?? "").trim(),
    game: match[2] ? "sts1" : "sts2",
    version: match[3] ?? null,
  };
}

function entityNames(entity: EntityInfo): string[] {
  return [
    entity.nameKo,
    entity.nameEn,
    ...(entity.aliasesKo ?? []),
    ...(entity.aliasesEn ?? []),
  ].filter((name): name is string => Boolean(name?.trim()));
}

export function pagestormReferenceExact(name: string, entities: readonly EntityInfo[]): EntityInfo | null {
  const key = normalizeKeywordLookupKey(name);
  const lower = name.trim().toLowerCase();
  if (!key && !lower) return null;
  return entities.find((entity) => entityNames(entity).some((label) => {
    const trimmed = label.trim();
    return trimmed.toLowerCase() === lower || normalizeKeywordLookupKey(trimmed) === key;
  })) ?? null;
}

export function resolvePagestormReference(
  raw: string,
  sts2: readonly EntityInfo[],
  sts1: readonly EntityInfo[],
): EntityInfo | null {
  const query = parsePagestormReferenceQuery(raw);
  if (!query.name || query.version) return null;
  if (query.game === "sts1") return pagestormReferenceExact(query.name, sts1);
  return pagestormReferenceExact(query.name, sts2) ?? pagestormReferenceExact(query.name, sts1);
}

function prefer(primary: EntityInfo[], secondary: EntityInfo[], limit: number): EntityInfo[] {
  const seen = new Set<string>();
  const ordered: EntityInfo[] = [];
  for (const entity of [...primary, ...secondary]) {
    const key = `${entity.type}:${entity.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    ordered.push(entity);
    if (ordered.length >= limit) break;
  }
  return ordered;
}

/**
 * Same-name matches list Slay the Spire 2 first. `#1` lists Slay the Spire 1
 * first, including a prefix such as `타#1`. An exact Slay the Spire 1 name
 * that is not also an exact Slay the Spire 2 name leads even without `#1`.
 */
export function rankPagestormReferences(
  raw: string,
  sts2: readonly EntityInfo[],
  sts1: readonly EntityInfo[],
  limit = 8,
): EntityInfo[] {
  const query = parsePagestormReferenceQuery(raw);
  if (!query.name) return [];
  const sts2Matches = matchEntities(query.name, [...sts2], limit);
  const sts1Matches = matchEntities(query.name, [...sts1], limit);
  const exactSts2 = pagestormReferenceExact(query.name, sts2);
  const exactSts1 = pagestormReferenceExact(query.name, sts1);
  if (query.game === "sts1") {
    const sts1First = exactSts1
      ? [exactSts1, ...sts1Matches.filter((entity) => entity !== exactSts1)]
      : sts1Matches;
    return prefer(sts1First, sts2Matches, limit);
  }
  if (exactSts1 && !exactSts2) {
    return prefer(
      [exactSts1],
      [...sts2Matches, ...sts1Matches.filter((entity) => entity !== exactSts1)],
      limit,
    );
  }
  return prefer(sts2Matches, sts1Matches, limit);
}

export function pagestormMentionDescription(entity: EntityInfo): string {
  const extra = (entity as EntityInfo & { mentionDescription?: string }).mentionDescription;
  return extra?.trim() || entityKeywordDescription(entity) || "";
}
