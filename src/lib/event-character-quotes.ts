import type { CodexCharacterQuotes } from "./codex-types";

export const EVENT_CHARACTER_QUOTE_PLACEHOLDER_NAMES = ["Monologue", "AromaPrinciple"] as const;

export type EventCharacterQuotePlaceholder =
  (typeof EVENT_CHARACTER_QUOTE_PLACEHOLDER_NAMES)[number];

const QUOTE_FIELD_BY_PLACEHOLDER = {
  Monologue: "goldMonologue",
  AromaPrinciple: "aromaPrinciple",
} as const satisfies Record<EventCharacterQuotePlaceholder, keyof CodexCharacterQuotes>;

const PLACEHOLDER_PATTERN = /\{(Monologue|AromaPrinciple)\}|\[(Monologue|AromaPrinciple)\]/g;
const PLACEHOLDER_TEST = /\{(?:Monologue|AromaPrinciple)\}|\[(?:Monologue|AromaPrinciple)\]/;

export interface EventCharacterQuoteSpeaker {
  id: string;
  name: string;
  iconUrl: string;
  quotes: Pick<CodexCharacterQuotes, "goldMonologue" | "aromaPrinciple">;
}

export type EventDescriptionSegment =
  | { type: "text"; value: string }
  | { type: "quote"; placeholder: EventCharacterQuotePlaceholder; count: number };

export function isEventCharacterQuotePlaceholder(
  name: string,
): name is EventCharacterQuotePlaceholder {
  return (EVENT_CHARACTER_QUOTE_PLACEHOLDER_NAMES as readonly string[]).includes(name);
}

export function toEventCharacterQuoteSpeaker(character: {
  id: string;
  name: string;
  iconUrl: string;
  quotes: CodexCharacterQuotes;
}): EventCharacterQuoteSpeaker {
  return {
    id: character.id,
    name: character.name,
    iconUrl: character.iconUrl,
    quotes: {
      goldMonologue: character.quotes.goldMonologue,
      aromaPrinciple: character.quotes.aromaPrinciple,
    },
  };
}

export function eventCharacterQuoteForPlaceholder(
  quotes: EventCharacterQuoteSpeaker["quotes"],
  placeholder: EventCharacterQuotePlaceholder,
): string {
  return quotes[QUOTE_FIELD_BY_PLACEHOLDER[placeholder]];
}

export function applyEventCharacterQuotes(
  text: string,
  quotes: EventCharacterQuoteSpeaker["quotes"],
): string {
  return text.replace(PLACEHOLDER_PATTERN, (_match, curly: string | undefined, square: string | undefined) => {
    const placeholder = (curly ?? square) as EventCharacterQuotePlaceholder;
    return eventCharacterQuoteForPlaceholder(quotes, placeholder);
  });
}

export function eventHasCharacterQuotePlaceholders(text: string | null | undefined): boolean {
  return Boolean(text && PLACEHOLDER_TEST.test(text));
}

export function eventContainsCharacterQuotePlaceholders(event: {
  description?: string | null;
  descriptionEn?: string | null;
  pages?: ReadonlyArray<{ description?: string | null }> | null;
}): boolean {
  if (eventHasCharacterQuotePlaceholders(event.description)) return true;
  if (eventHasCharacterQuotePlaceholders(event.descriptionEn)) return true;
  for (const page of event.pages ?? []) {
    if (eventHasCharacterQuotePlaceholders(page.description)) return true;
  }
  return false;
}

export function splitEventDescriptionQuotes(text: string): EventDescriptionSegment[] {
  const raw: EventDescriptionSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(PLACEHOLDER_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      raw.push({ type: "text", value: text.slice(lastIndex, index) });
    }
    const placeholder = (match[1] ?? match[2]) as EventCharacterQuotePlaceholder;
    raw.push({ type: "quote", placeholder, count: 1 });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    raw.push({ type: "text", value: text.slice(lastIndex) });
  }

  if (raw.length === 0) return [{ type: "text", value: text }];
  return mergeAdjacentQuoteSegments(raw);
}

function mergeAdjacentQuoteSegments(segments: EventDescriptionSegment[]): EventDescriptionSegment[] {
  const merged: EventDescriptionSegment[] = [];

  for (const segment of segments) {
    if (segment.type !== "quote") {
      merged.push(segment);
      continue;
    }

    const previous = merged[merged.length - 1];
    const quoteBeforeWhitespace = previous?.type === "text" && /^\s*$/.test(previous.value)
      ? merged[merged.length - 2]
      : previous;
    if (
      quoteBeforeWhitespace?.type === "quote"
      && quoteBeforeWhitespace.placeholder === segment.placeholder
    ) {
      quoteBeforeWhitespace.count += segment.count;
      if (previous?.type === "text") merged.pop();
      continue;
    }

    merged.push({ ...segment });
  }

  return merged;
}

export function characterQuoteSearchParts(
  characters: ReadonlyArray<{ quotes: EventCharacterQuoteSpeaker["quotes"] }>,
): string[] {
  return characters.flatMap((character) => [
    character.quotes.goldMonologue,
    character.quotes.aromaPrinciple,
  ]);
}
