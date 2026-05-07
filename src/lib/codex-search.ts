import { getChoseong } from "es-hangul";

export interface CodexSearchOption {
  value: string;
  label: string;
  desc: string;
}

export interface CodexSearchTriggerGroup<TokenType extends string = string> {
  trigger: string;
  type?: TokenType;
  label: string;
  items: CodexSearchOption[];
  validate?: (val: string) => string | null;
  chipColor?: string;
  maxPreviewItems?: number;
}

export interface CodexSearchToken<TokenType extends string = string> {
  type: TokenType;
  value: string;
  raw: string;
  trigger: string;
}

export interface ParsedCodexSearch<TokenType extends string = string> {
  text: string;
  tokens: CodexSearchToken<TokenType>[];
}

export function parseCodexSearch<TokenType extends string>(
  query: string,
  groups: CodexSearchTriggerGroup<TokenType>[],
): ParsedCodexSearch<TokenType> {
  const tokens: CodexSearchToken<TokenType>[] = [];
  const textParts: string[] = [];
  const parts = query.split(/\s+/).filter(Boolean);

  for (const part of parts) {
    const matchingGroups = groups.filter((group) => part.startsWith(group.trigger));
    if (matchingGroups.length === 0) {
      textParts.push(part);
      continue;
    }

    const groupValue = part.slice(matchingGroups[0].trigger.length).toLowerCase();
    const resolved = matchingGroups.find((group) => group.type && group.validate?.(groupValue));

    if (resolved?.type) {
      tokens.push({
        type: resolved.type,
        value: resolved.validate!(groupValue)!,
        raw: part,
        trigger: resolved.trigger,
      });
    } else {
      textParts.push(part);
    }
  }

  return { text: textParts.join(" ").toLowerCase(), tokens };
}

export function stripCodexMarkup(text: string): string {
  return text.replace(/\[\/?\w+(?::?\w*)*\]/g, "");
}

export function fuzzyMatchCodexText(text: string, query: string): boolean {
  if (!query) return true;
  const lt = text.toLowerCase();
  const lq = query.toLowerCase();
  if (lt.includes(lq)) return true;

  if (/^[ㄱ-ㅎ]+$/.test(query) && getChoseong(text).includes(query)) {
    return true;
  }

  let qi = 0;
  for (let i = 0; i < lt.length && qi < lq.length; i++) {
    if (lt[i] === lq[qi]) qi++;
  }
  return qi === lq.length;
}

export function getCurrentCodexSearchTrigger(
  value: string,
  groups: CodexSearchTriggerGroup[],
): { trigger: string; query: string; startIndex: number } | null {
  const lastSpaceIndex = value.lastIndexOf(" ");
  const currentWord = value.slice(lastSpaceIndex + 1);
  const startIndex = lastSpaceIndex + 1;
  const triggers = [...new Set(groups.map((group) => group.trigger))].sort(
    (a, b) => b.length - a.length,
  );

  for (const trigger of triggers) {
    if (currentWord.startsWith(trigger) && currentWord.length > trigger.length) {
      return {
        trigger,
        query: currentWord.slice(trigger.length).toLowerCase(),
        startIndex,
      };
    }
    if (currentWord === trigger) {
      return { trigger, query: "", startIndex };
    }
  }
  return null;
}

export function getFilteredCodexSearchItems(
  trigger: string,
  query: string,
  groups: CodexSearchTriggerGroup[],
): CodexSearchOption[] {
  const items = groups
    .filter((group) => group.trigger === trigger)
    .flatMap((group) => group.items);
  if (!query) return dedupeSearchOptions(items);

  return dedupeSearchOptions(
    items.filter(
      (item) =>
        item.value.toLowerCase().includes(query) ||
        item.label.toLowerCase().includes(query) ||
        item.desc.toLowerCase().includes(query),
    ),
  );
}

export function isKnownCodexSearchToken(
  token: string,
  groups: CodexSearchTriggerGroup[],
): boolean {
  return groups.some((group) => token.startsWith(group.trigger));
}

export function isValidCodexSearchToken(
  token: string,
  groups: CodexSearchTriggerGroup[],
): boolean {
  const matchingGroups = groups.filter((group) => token.startsWith(group.trigger));
  if (matchingGroups.length === 0) return false;

  const value = token.slice(matchingGroups[0].trigger.length).toLowerCase();
  return matchingGroups.some((group) => !group.validate || group.validate(value) !== null);
}

function dedupeSearchOptions(items: CodexSearchOption[]): CodexSearchOption[] {
  const seen = new Set<string>();
  const result: CodexSearchOption[] = [];
  for (const item of items) {
    const key = `${item.value}\u0000${item.label}\u0000${item.desc}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}
