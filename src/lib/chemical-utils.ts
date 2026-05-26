import type { JSONContent } from "@tiptap/react";
import { getChoseong } from "es-hangul";
import type { EntityInfo, EntityType } from "@/components/patch-note-renderer";
import type { PostBlock } from "@/lib/chemical-types";

const ENTITY_TYPE_FALLBACK_PRIORITY: readonly EntityType[] = [
  "card",
  "relic",
  "power",
  "potion",
  "enchantment",
  "monster",
  "event",
  "encounter",
  "ancient",
  "epoch",
];

function uniqueStrings(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

/**
 * Convert TipTap editor JSON to PostBlock array for storage.
 */
export function tiptapToBlocks(doc: JSONContent): PostBlock[] {
  const blocks: PostBlock[] = [];
  if (!doc.content) return blocks;

  for (const paragraph of doc.content) {
    if (!paragraph.content) continue;
    for (const node of paragraph.content) {
      if (node.type === "text" && node.text) {
        blocks.push({ type: "text", text: node.text });
      } else if (node.type === "entity-mention") {
        blocks.push({
          type: "entity",
          entityId: node.attrs?.id ?? "",
          entityType: node.attrs?.entityType ?? "card",
          displayText: node.attrs?.label ?? "",
        });
      } else if (node.type === "custom-keyword") {
        const entityId = node.attrs?.entityId ?? "";
        const entityType = node.attrs?.entityType ?? "";
        blocks.push({
          type: "keyword",
          text: node.attrs?.text ?? "",
          keyword: node.attrs?.keyword ?? "",
          description: node.attrs?.description ?? "",
          entityId: entityId || undefined,
          entityType: (entityType || undefined) as EntityType | undefined,
        });
      }
    }
  }
  return blocks;
}

/**
 * Convert PostBlock array to plain text for character counting.
 */
export function blocksToPlainText(blocks: PostBlock[]): string {
  return blocks
    .map((b) => {
      if (b.type === "text") return b.text;
      if (b.type === "keyword") return b.text;
      return b.displayText;
    })
    .join("");
}

/**
 * Convert PostBlock array to a recoverable plain text form for legacy storage.
 *
 * `content_blocks` is the canonical rich payload, but comments also keep a
 * plain `content` column for legacy/fallback reads. Keyword blocks need their
 * lookup keyword preserved there; otherwise `label{keyword}` degrades to just
 * `label` if the rich column is unavailable.
 */
export function blocksToStorageText(blocks: PostBlock[]): string {
  return blocks
    .map((b) => {
      if (b.type === "text") return b.text;
      if (b.type === "entity") return b.displayText;

      const text = b.text;
      const keyword = b.keyword?.trim();
      return keyword ? `${text}{${keyword}}` : text;
    })
    .join("");
}

export function entityDisplayNames(entity: EntityInfo): string[] {
  return uniqueStrings([
    entity.nameKo,
    entity.nameEn,
    ...(entity.aliasesKo ?? []),
    ...(entity.aliasesEn ?? []),
  ]);
}

function sanitizeLookupText(text: string): string {
  return text
    .replace(/\uFFFC/g, "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/뱃지/g, "배지")
    .trim();
}

function normalizeLookupToken(token: string): string {
  const cleaned = token
    .replace(/^[`'"“”‘’]+|[`'"“”‘’]+$/g, "")
    .replace(/(?:'s|’s)$/i, "");

  if (/^[가-힣]{2,}의$/.test(cleaned)) {
    return cleaned.slice(0, -1);
  }

  return cleaned;
}

function keywordLookupTokens(text: string): string[] {
  return sanitizeLookupText(text)
    .split(/[^\p{L}\p{N}'’]+/u)
    .map(normalizeLookupToken)
    .filter(Boolean);
}

export function normalizeKeywordLookupKey(text: string): string {
  return keywordLookupTokens(text).join("");
}

type EntityKeywordCandidate = {
  entity: EntityInfo;
  key: string;
  tokens: string[];
};

export interface EntityKeywordIndex {
  exact: Map<string, EntityInfo[]>;
  candidates: EntityKeywordCandidate[];
}

function addExactEntity(
  exact: Map<string, EntityInfo[]>,
  key: string,
  entity: EntityInfo,
) {
  const matches = exact.get(key) ?? [];
  if (!matches.some((match) => match.id === entity.id && match.type === entity.type)) {
    matches.push(entity);
  }
  exact.set(key, matches);
}

export function buildEntityKeywordIndex(entities: EntityInfo[]): EntityKeywordIndex {
  const exact = new Map<string, EntityInfo[]>();
  const candidates: EntityKeywordCandidate[] = [];
  const seenCandidates = new Set<string>();

  for (const entity of entities) {
    for (const name of entityDisplayNames(entity)) {
      const tokens = keywordLookupTokens(name);
      const key = tokens.join("");
      if (!key) continue;

      addExactEntity(exact, key, entity);

      const candidateKey = `${entity.type}:${entity.id}:${key}`;
      if (seenCandidates.has(candidateKey)) continue;
      seenCandidates.add(candidateKey);
      candidates.push({ entity, key, tokens });
    }
  }

  return { exact, candidates };
}

function entityTypePriority(entity: EntityInfo): number {
  const index = ENTITY_TYPE_FALLBACK_PRIORITY.indexOf(entity.type);
  return index === -1 ? ENTITY_TYPE_FALLBACK_PRIORITY.length : index;
}

function sortEntitiesByFallbackPriority(entities: EntityInfo[]): EntityInfo[] {
  return [...entities].sort((a, b) => {
    const priorityDiff = entityTypePriority(a) - entityTypePriority(b);
    if (priorityDiff !== 0) return priorityDiff;
    return `${a.type}:${a.id}`.localeCompare(`${b.type}:${b.id}`, "ko");
  });
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost,
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[b.length] ?? 0;
}

function keywordCandidateScore(
  queryKey: string,
  queryTokens: string[],
  candidate: EntityKeywordCandidate,
): number {
  if (candidate.key === queryKey) return 100;

  if (queryKey.length >= 4 && candidate.key.includes(queryKey)) {
    return 90 + Math.min(8, (queryKey.length / candidate.key.length) * 8);
  }

  if (candidate.key.length >= 4 && queryKey.includes(candidate.key)) {
    return 86 + Math.min(8, (candidate.key.length / queryKey.length) * 8);
  }

  if (queryTokens.length >= 2 && candidate.tokens.length >= 2) {
    const candidateTokenSet = new Set(candidate.tokens);
    const overlap = queryTokens.filter((token) => candidateTokenSet.has(token)).length;
    const queryCoverage = overlap / queryTokens.length;
    const candidateCoverage = overlap / candidate.tokens.length;
    if (overlap >= 2 && queryCoverage >= 0.67 && candidateCoverage >= 0.5) {
      return 72 + queryCoverage * 12 + candidateCoverage * 6;
    }
  }

  if (queryKey.length >= 5 && candidate.key.length >= 5) {
    const maxLength = Math.max(queryKey.length, candidate.key.length);
    const similarity = 1 - levenshteinDistance(queryKey, candidate.key) / maxLength;
    if (similarity >= 0.82) return 60 + similarity * 10;
  }

  return 0;
}

export function resolveEntityKeyword(
  keyword: string,
  index: EntityKeywordIndex,
): EntityInfo | undefined {
  const queryTokens = keywordLookupTokens(keyword);
  const queryKey = queryTokens.join("");
  if (!queryKey) return undefined;

  const exactMatches = index.exact.get(queryKey);
  if (exactMatches?.length) {
    return sortEntitiesByFallbackPriority(exactMatches)[0];
  }

  const matches = index.candidates
    .map((candidate) => ({
      entity: candidate.entity,
      score: keywordCandidateScore(queryKey, queryTokens, candidate),
    }))
    .filter((match) => match.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const priorityDiff = entityTypePriority(a.entity) - entityTypePriority(b.entity);
      if (priorityDiff !== 0) return priorityDiff;
      return `${a.entity.type}:${a.entity.id}`.localeCompare(`${b.entity.type}:${b.entity.id}`, "ko");
    });

  return matches[0]?.entity;
}

export function entityKeywordDescription(entity: EntityInfo): string | null {
  return (
    entity.cardData?.description
    ?? entity.relicData?.description
    ?? entity.potionData?.description
    ?? entity.powerData?.description
    ?? entity.enchantmentData?.description
    ?? entity.eventOptionDesc
    ?? entity.eventData?.description
    ?? entity.ancientData?.epithet
    ?? null
  );
}

/**
 * Search entities by query string.
 * Supports: Korean name, English name, and Korean choseong (jamo) matching.
 * Triggers from 1 character. Prioritizes prefix > choseong > includes.
 */
export function matchEntities(
  query: string,
  entities: EntityInfo[],
  limit = 8,
): EntityInfo[] {
  if (query.length < 1) return [];
  const lower = query.toLowerCase();
  const queryKey = normalizeKeywordLookupKey(query);
  const isAllJamo = /^[ㄱ-ㅎ]+$/.test(query);

  const prefixMatches: EntityInfo[] = [];
  const choseongMatches: EntityInfo[] = [];
  const includesMatches: EntityInfo[] = [];
  const fuzzyMatches: EntityInfo[] = [];

  for (const e of entities) {
    const names = entityDisplayNames(e);
    const lowerNames = names.map((name) => name.toLowerCase());
    const normalizedNames = names.map(normalizeKeywordLookupKey).filter(Boolean);

    if (lowerNames.some((name) => name.startsWith(lower))) {
      prefixMatches.push(e);
    } else if (queryKey && normalizedNames.some((name) => name.startsWith(queryKey))) {
      prefixMatches.push(e);
    } else if (isAllJamo && names.some((name) => /[가-힣]/.test(name) && getChoseong(name).includes(query))) {
      choseongMatches.push(e);
    } else if (
      lowerNames.some((name) => name.includes(lower))
      || (queryKey.length >= 2 && normalizedNames.some((name) => name.includes(queryKey)))
    ) {
      includesMatches.push(e);
    } else if (queryKey.length >= 4) {
      const candidate = resolveEntityKeyword(query, buildEntityKeywordIndex([e]));
      if (candidate) fuzzyMatches.push(e);
    }

    const total = prefixMatches.length + choseongMatches.length + includesMatches.length + fuzzyMatches.length;
    if (total >= limit * 2) break;
  }

  return [...prefixMatches, ...choseongMatches, ...includesMatches, ...fuzzyMatches].slice(0, limit);
}
