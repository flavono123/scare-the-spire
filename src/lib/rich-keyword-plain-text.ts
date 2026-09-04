/**
 * Plain-text keyword activation for comment-like TipTap editors.
 *
 * Suggestions stay brace-triggered. Completed tokens that exactly match a
 * known keyword/entity name can still become keyword nodes.
 */

export type ExactKeywordLabel = {
  label: string;
  lower: string;
  ascii: boolean;
};

function isTokenChar(char: string | undefined): boolean {
  return Boolean(char && /[\p{L}\p{N}+]/u.test(char));
}

function hasTokenBoundary(
  text: string,
  start: number,
  end: number,
  ascii: boolean,
): boolean {
  const before = start > 0 ? text[start - 1] : "";
  const after = end < text.length ? text[end] : "";
  if (isTokenChar(before) || isTokenChar(after)) return false;
  if (!ascii) return true;
  return !isAsciiWordChar(before) && !isAsciiWordChar(after);
}

function isAsciiWordChar(char: string | undefined): boolean {
  return Boolean(char && /[a-z0-9_]/i.test(char));
}

export function matchOpenBraceKeyword(text: string): {
  full: string;
  query: string;
} | null {
  const wrap = text.match(/(\S+)\{([^{}\n]*)$/);
  if (wrap) {
    return {
      full: wrap[0] ?? "",
      query: (wrap[2] ?? "").trim(),
    };
  }

  const bare = text.match(/\{([^{}\n]*)$/);
  if (!bare) return null;
  return {
    full: bare[0] ?? "",
    query: (bare[1] ?? "").trim(),
  };
}

export function buildExactKeywordLabels(names: string[]): ExactKeywordLabel[] {
  const seen = new Set<string>();
  const labels: ExactKeywordLabel[] = [];

  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed || trimmed.includes("{") || trimmed.includes("}")) continue;
    const lower = trimmed.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    labels.push({
      label: trimmed,
      lower,
      ascii: /^[\x00-\x7F]+$/.test(trimmed),
    });
  }

  labels.sort((a, b) => b.lower.length - a.lower.length);
  return labels;
}

export function buildExactKeywordIndex(
  labels: ExactKeywordLabel[],
): Map<string, ExactKeywordLabel[]> {
  const byFirst = new Map<string, ExactKeywordLabel[]>();
  for (const label of labels) {
    const first = label.lower[0] ?? "";
    const bucket = byFirst.get(first);
    if (bucket) bucket.push(label);
    else byFirst.set(first, [label]);
  }
  return byFirst;
}

function bracePendingRanges(text: string): Array<{ start: number; end: number }> {
  return [...text.matchAll(/\S*\{[^{}\n]*/g)].map((match) => {
    const start = match.index ?? 0;
    return { start, end: start + match[0].length };
  });
}

function rangeOverlaps(
  start: number,
  end: number,
  ranges: Array<{ start: number; end: number }>,
): boolean {
  return ranges.some((range) => start < range.end && end > range.start);
}

export function inProgressKeywordRange(
  text: string,
  cursorOffset: number,
  commitCursorToken: boolean,
): { start: number; end: number } | null {
  if (commitCursorToken) return null;

  const clamped = Math.max(0, Math.min(cursorOffset, text.length));
  const atToken = isTokenChar(text[clamped]);
  const afterToken = clamped > 0 && isTokenChar(text[clamped - 1]);
  if (!atToken && !afterToken) return null;

  let start = clamped;
  let end = atToken ? clamped + 1 : clamped;
  while (start > 0 && isTokenChar(text[start - 1])) start -= 1;
  while (end < text.length && isTokenChar(text[end])) end += 1;
  if (start >= end) return null;
  return { start, end };
}

export function findExactKeywordRanges(
  text: string,
  labelsByFirst: Map<string, ExactKeywordLabel[]>,
  skipRange?: { start: number; end: number } | null,
): Array<{ from: number; to: number; label: string }> {
  if (!text || labelsByFirst.size === 0) return [];

  const pending = bracePendingRanges(text);
  const skips = [
    ...pending,
    ...(skipRange ? [skipRange] : []),
  ];
  const lower = text.toLowerCase();
  const ranges: Array<{ from: number; to: number; label: string }> = [];
  let index = 0;

  while (index < text.length) {
    const blocked = skips.find((range) => index >= range.start && index < range.end);
    if (blocked) {
      index = blocked.end;
      continue;
    }

    const labels = labelsByFirst.get(lower[index] ?? "");
    if (!labels) {
      index += 1;
      continue;
    }

    let matched = false;
    for (const label of labels) {
      if (!lower.startsWith(label.lower, index)) continue;
      const end = index + label.lower.length;
      if (!hasTokenBoundary(text, index, end, label.ascii)) continue;
      if (rangeOverlaps(index, end, skips)) continue;
      ranges.push({
        from: index,
        to: end,
        label: text.slice(index, end),
      });
      index = end;
      matched = true;
      break;
    }

    if (!matched) index += 1;
  }

  return ranges;
}
