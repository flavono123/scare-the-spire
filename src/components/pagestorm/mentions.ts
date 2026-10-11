import type { Editor } from "@tiptap/react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import {
  buildExactKeywordIndex,
  buildExactKeywordLabels,
  findExactKeywordRanges,
  inProgressKeywordRange,
} from "@/lib/rich-keyword-plain-text";
import {
  pagestormMentionDescription,
  parsePagestormReferenceQuery,
  resolvePagestormReference,
} from "@/lib/pagestorm-reference";

type MentionEntity = EntityInfo & { mentionDescription?: string };

const STS1_MARKER = /([^\s{}#@]+)#1(?:@(\d+(?:\.\d+)*))?/g;
const CLOSED_BRACE = /\{([^{}\n]+)\}/g;

let labelCacheKey: readonly EntityInfo[] | null = null;
let labelCacheSts1: readonly EntityInfo[] | null = null;
let labelCache = buildExactKeywordIndex([]);

function mentionLabelIndex(sts2: readonly EntityInfo[], sts1: readonly EntityInfo[]) {
  if (labelCacheKey === sts2 && labelCacheSts1 === sts1) return labelCache;
  labelCacheKey = sts2;
  labelCacheSts1 = sts1;
  labelCache = buildExactKeywordIndex(buildExactKeywordLabels([
    ...sts2.flatMap((entity) => [entity.nameKo, entity.nameEn, ...(entity.aliasesKo ?? []), ...(entity.aliasesEn ?? [])]),
    ...sts1.flatMap((entity) => [entity.nameKo, entity.nameEn]),
  ]));
  return labelCache;
}

export function pagestormMentionContent(entity: MentionEntity, text?: string) {
  return {
    type: "pagestormMention",
    attrs: {
      text: text?.trim() || entity.nameKo,
      keyword: entity.nameKo,
      description: pagestormMentionDescription(entity),
      entityId: entity.id,
      entityType: entity.type,
    },
  };
}

function rangesOverlap(
  start: number,
  end: number,
  ranges: Array<{ start: number; end: number }>,
): boolean {
  return ranges.some((range) => start < range.end && end > range.start);
}

function markerRanges(text: string): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  for (const match of text.matchAll(STS1_MARKER)) {
    if (match.index == null) continue;
    const before = match.index > 0 ? text[match.index - 1] : "";
    if (before && /[\p{L}\p{N}+]/u.test(before)) continue;
    const start = match.index;
    const end = start + match[0].length;
    const after = end < text.length ? text[end] : "";
    if (after && /[\p{L}\p{N}+]/u.test(after)) continue;
    ranges.push({ start, end });
  }
  return ranges;
}

/**
 * Turn closed `{name}`, `{name#1}`, bare `name#1`, and exact names into mentions.
 * `#1` is applied before a bare name so `타격#1` does not become the STS2 card.
 * `@version` stays as text.
 */
export function replacePagestormMentions(
  editor: Editor,
  sts2: readonly EntityInfo[],
  sts1: readonly MentionEntity[],
): boolean {
  const mention = editor.schema.nodes.pagestormMention;
  if (!mention || !editor.isEditable) return false;
  const cursor = editor.state.selection.from;
  const replacements: Array<{ from: number; to: number; entity: EntityInfo; text: string }> = [];
  const labelIndex = mentionLabelIndex(sts2, sts1);

  editor.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = node.text;
    const cursorOffset = cursor >= pos && cursor <= pos + node.nodeSize
      ? cursor - pos
      : null;
    const covered: Array<{ start: number; end: number }> = [];

    for (const match of text.matchAll(CLOSED_BRACE)) {
      if (match.index == null) continue;
      const inside = match[1] ?? "";
      const parsed = parsePagestormReferenceQuery(inside);
      if (parsed.version) continue;
      const entity = resolvePagestormReference(inside, sts2, sts1);
      if (!entity) continue;
      const start = match.index;
      const end = start + match[0].length;
      covered.push({ start, end });
      replacements.push({
        from: pos + start,
        to: pos + end,
        entity,
        text: entity.nameKo,
      });
    }

    for (const match of text.matchAll(STS1_MARKER)) {
      if (match.index == null || match[2]) continue;
      const before = match.index > 0 ? text[match.index - 1] : "";
      if (before && /[\p{L}\p{N}+]/u.test(before)) continue;
      const start = match.index;
      const end = start + match[0].length;
      const after = end < text.length ? text[end] : "";
      if (after && /[\p{L}\p{N}+]/u.test(after)) continue;
      if (cursorOffset != null && cursorOffset >= start && cursorOffset <= end) continue;
      if (rangesOverlap(start, end, covered)) continue;
      const entity = resolvePagestormReference(match[0], sts2, sts1);
      if (!entity) continue;
      covered.push({ start, end });
      replacements.push({
        from: pos + start,
        to: pos + end,
        entity,
        text: entity.nameKo,
      });
    }

    const skip = cursorOffset == null
      ? null
      : inProgressKeywordRange(text, cursorOffset, false);
    const blocked = [
      ...covered,
      ...markerRanges(text),
      ...[...text.matchAll(/([^\s{}#@]+)#/g)].flatMap((match) => (
        match.index == null ? [] : [{ start: match.index, end: match.index + (match[1]?.length ?? 0) }]
      )),
    ];
    for (const range of findExactKeywordRanges(text, labelIndex, skip)) {
      if (rangesOverlap(range.from, range.to, blocked)) continue;
      const entity = resolvePagestormReference(range.label, sts2, sts1);
      if (!entity) continue;
      replacements.push({
        from: pos + range.from,
        to: pos + range.to,
        entity,
        text: range.label,
      });
    }
  });

  if (!replacements.length) return false;
  const tr = editor.state.tr;
  const unique = replacements.sort((a, b) => b.from - a.from);
  for (const replacement of unique) {
    tr.replaceWith(replacement.from, replacement.to, mention.create({
      text: replacement.text,
      keyword: replacement.entity.nameKo,
      description: pagestormMentionDescription(replacement.entity),
      entityId: replacement.entity.id,
      entityType: replacement.entity.type,
    }));
  }
  editor.view.dispatch(tr);
  return true;
}
