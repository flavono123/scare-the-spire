import type { EntityInfo } from "@/components/patch-note-renderer";
import { GOLD_TERM_DESC, KEYWORD_DESC } from "@/components/codex/codex-description";
import {
  buildEntityKeywordIndex,
  entityDisplayNames,
  entityKeywordDescription,
  resolveEntityKeyword,
  type EntityKeywordIndex,
} from "@/lib/chemical-utils";
import type { PostBlock } from "@/lib/chemical-types";

interface LegacyInlineCandidate {
  value: string;
  lowerValue: string;
  kind: "entity" | "keyword";
  entityId?: string;
  entityType?: EntityInfo["type"];
  description?: string;
}

export interface RichContentIndexes {
  keywordEntityIndex: EntityKeywordIndex;
  legacyInlineIndex: Map<string, LegacyInlineCandidate[]>;
}

const EXPLICIT_KEYWORD_RE = /(\S+)\{(\S(?:[^{}\n]*\S)?)\}/g;

function buildLegacyInlineIndex(entities: EntityInfo[]): Map<string, LegacyInlineCandidate[]> {
  const index = new Map<string, LegacyInlineCandidate[]>();
  const seen = new Set<string>();

  const addCandidate = (candidate: LegacyInlineCandidate) => {
    const normalized = candidate.lowerValue;
    const minLength = candidate.kind === "entity" ? 1 : 2;
    if (Array.from(candidate.value).length < minLength || seen.has(`${candidate.kind}:${normalized}`)) return;

    seen.add(`${candidate.kind}:${normalized}`);
    const firstChar = normalized[0];
    const bucket = index.get(firstChar) ?? [];
    bucket.push(candidate);
    index.set(firstChar, bucket);
  };

  for (const entity of entities) {
    for (const value of entityDisplayNames(entity)) {
      const trimmed = value.trim();
      if (!trimmed) continue;
      addCandidate({
        value: trimmed,
        lowerValue: trimmed.toLowerCase(),
        kind: "entity",
        entityId: entity.id,
        entityType: entity.type,
      });
    }
  }

  for (const [value, description] of Object.entries({ ...KEYWORD_DESC, ...GOLD_TERM_DESC })) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    addCandidate({
      value: trimmed,
      lowerValue: trimmed.toLowerCase(),
      kind: "keyword",
      description,
    });
  }

  for (const bucket of index.values()) {
    bucket.sort((a, b) => {
      if (b.value.length !== a.value.length) return b.value.length - a.value.length;
      if (a.kind !== b.kind) return a.kind === "entity" ? -1 : 1;
      return a.value.localeCompare(b.value, "ko");
    });
  }

  return index;
}

function hasAsciiWordBoundary(candidate: LegacyInlineCandidate, content: string, start: number): boolean {
  if (!/[a-z0-9]/i.test(candidate.value)) return true;

  const prev = content[start - 1] ?? "";
  const next = content[start + candidate.value.length] ?? "";
  return !/[a-z0-9]/i.test(prev) && !/[a-z0-9]/i.test(next);
}

function parseLegacyContentBlocks(
  content: string,
  index: Map<string, LegacyInlineCandidate[]>,
): PostBlock[] {
  const blocks: PostBlock[] = [];
  const lowerContent = content.toLowerCase();
  let cursor = 0;
  let textStart = 0;

  while (cursor < content.length) {
    const bucket = index.get(lowerContent[cursor]);
    let matched: LegacyInlineCandidate | null = null;

    if (bucket) {
      for (const candidate of bucket) {
        const slice = lowerContent.slice(cursor, cursor + candidate.value.length);
        if (slice !== candidate.lowerValue) continue;
        if (!hasAsciiWordBoundary(candidate, content, cursor)) continue;
        matched = candidate;
        break;
      }
    }

    if (!matched) {
      cursor += 1;
      continue;
    }

    if (textStart < cursor) {
      blocks.push({ type: "text", text: content.slice(textStart, cursor) });
    }

    const matchedText = content.slice(cursor, cursor + matched.value.length);
    if (matched.kind === "entity" && matched.entityId && matched.entityType) {
      blocks.push({
        type: "entity",
        entityId: matched.entityId,
        entityType: matched.entityType,
        displayText: matchedText,
      });
    } else if (matched.description) {
      blocks.push({
        type: "keyword",
        text: matchedText,
        keyword: matchedText,
        description: matched.description,
      });
    }

    cursor += matched.value.length;
    textStart = cursor;
  }

  if (textStart < content.length) {
    blocks.push({ type: "text", text: content.slice(textStart) });
  }

  return blocks.length > 0 ? blocks : [{ type: "text", text: content }];
}

function parseExplicitKeywordBlocks(
  content: string,
  keywordEntityIndex: EntityKeywordIndex,
): PostBlock[] | null {
  const blocks: PostBlock[] = [];
  let cursor = 0;
  let found = false;

  for (const match of content.matchAll(EXPLICIT_KEYWORD_RE)) {
    if (match.index == null) continue;

    const full = match[0] ?? "";
    const text = match[1]?.trim() ?? "";
    const keyword = match[2]?.trim() ?? "";
    if (!text || !keyword) continue;

    if (cursor < match.index) {
      blocks.push({ type: "text", text: content.slice(cursor, match.index) });
    }

    const entity = resolveEntityKeyword(keyword, keywordEntityIndex);
    const description = entity ? entityKeywordDescription(entity) ?? keyword : keyword;
    blocks.push({
      type: "keyword",
      text,
      keyword,
      description,
      entityId: entity?.id,
      entityType: entity?.type,
    });

    cursor = match.index + full.length;
    found = true;
  }

  if (!found) return null;
  if (cursor < content.length) {
    blocks.push({ type: "text", text: content.slice(cursor) });
  }
  return blocks.length > 0 ? blocks : null;
}

export function buildRichContentIndexes(entities: EntityInfo[]): RichContentIndexes {
  return {
    keywordEntityIndex: buildEntityKeywordIndex(entities),
    legacyInlineIndex: buildLegacyInlineIndex(entities),
  };
}

export function resolveRichContentBlocks(
  content: string,
  contentBlocks: PostBlock[] | null | undefined,
  indexes: RichContentIndexes,
): PostBlock[] {
  if (contentBlocks?.length) return contentBlocks;
  return parseExplicitKeywordBlocks(content, indexes.keywordEntityIndex)
    ?? parseLegacyContentBlocks(content, indexes.legacyInlineIndex);
}
