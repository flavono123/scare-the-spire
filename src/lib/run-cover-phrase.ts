import type { CoverElement, CoverSpec } from "@/lib/run-cover-types";
import type { ServiceLocale } from "@/lib/i18n";
import korTables from "@/lib/sts2-game-i18n/kor.json";
import {
  localizeGame,
  type GameI18nTables,
} from "@/lib/sts2-game-i18n";
import { isMadScienceCardId, MAD_SCIENCE_CARD_ID } from "@/lib/tinker-time";

export interface CoverPhraseMeta {
  win: boolean;
  totalFloors: number;
  ascension: number;
}

function stripKoreanParticles(name: string): "이" | "가" {
  const last = name[name.length - 1];
  if (!last) return "가";
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return "가";
  return (code - 0xac00) % 28 === 0 ? "가" : "이";
}

function elementName(element: CoverElement, tables: GameI18nTables): string {
  if (element.kind === "card" && isMadScienceCardId(element.id)) {
    return localizeGame(tables, "cards", MAD_SCIENCE_CARD_ID) ?? element.id;
  }
  const table =
    element.kind === "card"
      ? "cards"
      : element.kind === "relic"
        ? "relics"
        : "potions";
  return localizeGame(tables, table, element.id) ?? element.id;
}

type PhraseId =
  | "hook_mash"
  | "hook_why"
  | "hook_copies"
  | "hook_not_normal"
  | "hook_relics"
  | "hook_deck"
  | "hook_floor"
  | "hook_win"
  | "hook_fallback";

function renderPhrase(
  id: PhraseId,
  cover: CoverSpec,
  meta: CoverPhraseMeta | undefined,
  tables: GameI18nTables,
  serviceLocale: ServiceLocale,
  extras?: { relicCount?: number; deckSize?: number },
): string {
  const e0 = cover.elements[0];
  const e1 = cover.elements[1];
  const e0Name = e0 ? elementName(e0, tables) : "";
  const e1Name = e1 ? elementName(e1, tables) : "";
  const en = serviceLocale !== "ko";
  switch (id) {
    case "hook_mash":
      return (e1 ? `${e0Name} ${e1Name}` : e0Name).slice(0, 40);
    case "hook_why":
      return en ? `why ${e0Name}` : `${e0Name} 왜 씀`;
    case "hook_copies":
      return en
        ? `${e0?.copies ?? 1}x ${e0Name}`
        : `${e0Name} ${e0?.copies ?? 1}장`;
    case "hook_not_normal":
      return en
        ? `${e0Name} isn't normal`
        : `보통 ${e0Name}${stripKoreanParticles(e0Name)} 아니다`;
    case "hook_relics":
      return en
        ? `${extras?.relicCount ?? 0} relics`
        : `${extras?.relicCount ?? 0}유물`;
    case "hook_deck":
      return en
        ? `${extras?.deckSize ?? 0}-card deck`
        : `덱 ${extras?.deckSize ?? 0}장`;
    case "hook_floor":
      return en
        ? `floor ${meta?.totalFloors ?? 0}`
        : `${meta?.totalFloors ?? 0}층까지`;
    case "hook_win":
    case "hook_fallback":
      if (meta?.win) {
        return en ? `A${meta.ascension} clear` : `A${meta.ascension} 클리어`;
      }
      return en
        ? `floor ${meta?.totalFloors ?? 0}`
        : `${meta?.totalFloors ?? 0}층`;
  }
}

function matchStoredPhrase(
  stored: string,
  cover: CoverSpec,
  meta: CoverPhraseMeta | undefined,
): PhraseId | null {
  const kor = korTables as GameI18nTables;
  const candidates: PhraseId[] = [
    "hook_why",
    "hook_copies",
    "hook_not_normal",
    "hook_mash",
    "hook_win",
    "hook_floor",
    "hook_relics",
    "hook_deck",
    "hook_fallback",
  ];
  for (const id of candidates) {
    const rendered = renderPhrase(id, cover, meta, kor, "ko");
    if (rendered && stored.trim() === rendered.trim()) return id;
  }
  if (/^A\d+\s*클리어$/.test(stored.trim())) return "hook_win";
  return null;
}

/** Auto covers re-render in the current service locale; custom phrases stay stored. */
export function resolveCoverPhrase(
  cover: CoverSpec,
  meta: CoverPhraseMeta | undefined,
  serviceLocale: ServiceLocale,
  tables: GameI18nTables,
): string {
  if (!cover.auto) return cover.phrase;
  const matched = matchStoredPhrase(cover.phrase, cover, meta);
  if (!matched) return cover.phrase;
  return renderPhrase(matched, cover, meta, tables, serviceLocale);
}
