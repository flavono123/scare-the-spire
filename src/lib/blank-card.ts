// Pure rules of the 빈 카드 playtest (/dev/blank-card): answer pool, card text
// matching, hints, lives and score. No React, so scripts can check it.

import type { CodexCard } from "@/lib/codex-types";
import { parseDescription } from "@/lib/codex-card-description";
import {
  getCardDisplayKeywords,
  getCardKeywordDisplayText,
  splitCardDisplayKeywords,
} from "@/lib/sts2-card-keywords";

export const LIVES = 3;
export const HINTS = 3;
/** Tunable playtest scoring: a hint costs far more than an action. */
export const SCORE = { start: 1000, hint: 250, action: 40, life: 100, floor: 50 } as const;

export type HintKey = "cost" | "color" | "rarity" | "type";
export const HINT_KEYS: readonly HintKey[] = ["cost", "color", "rarity", "type"];

const ANSWER_COLORS = new Set([
  "ironclad", "silent", "defect", "necrobinder", "regent", "fool", "colorless", "curse", "token",
]);

/** Character, colorless, curse and token cards. Ancient cards use another tile layout, which would give them away. */
export function isBlankCardAnswer(card: CodexCard): boolean {
  return ANSWER_COLORS.has(card.color) && card.rarity !== "고대의 존재";
}

/** The value a hint reveals, also used to rotate the blank card. "" is a card without an energy cost. */
export function hintValue(card: CodexCard, key: HintKey): string {
  if (key === "cost") return card.isXCost ? "X" : card.cost < 0 ? "" : String(card.cost);
  if (key === "color") return card.visualColor ?? card.color;
  if (key === "rarity") return card.rarity;
  return card.type;
}

// One unmatchable character per icon keeps text offsets aligned with the slots.
const ICON_CHAR = "￼";

export interface TextSlot {
  /** CardTile descriptionMask slot ("" for a line break). */
  slot: string;
  text: string;
  start: number;
  icon?: "energy" | "star";
}

export interface CardText {
  slots: TextSlot[];
  plain: string;
  /** Offsets of icon characters, by icon kind. */
  icons: Record<"energy" | "star", number[]>;
}

/** Base card text in CardTile's plain render order (keywords, description, keywords), keyed by its mask slots. */
export function cardText(card: CodexCard): CardText {
  const { preDescriptionKeywords: pre, postDescriptionKeywords: post } = splitCardDisplayKeywords(
    getCardDisplayKeywords(card),
  );
  const parts = parseDescription(card.description);
  const slots: TextSlot[] = [];
  const icons: CardText["icons"] = { energy: [], star: [] };
  let plain = "";
  const push = (slot: string, text: string, icon?: TextSlot["icon"]) => {
    slots.push({ slot, text, start: plain.length, icon });
    if (icon) icons[icon].push(plain.length);
    plain += text;
  };
  const keyword = (kw: string, i: number) => {
    if (i > 0) push("", "\n");
    push(`k:${kw}`, `${getCardKeywordDisplayText(card, kw)}.`);
  };
  pre.forEach(keyword);
  if (pre.length > 0 && parts.length > 0) push("", "\n");
  parts.forEach((part, i) => {
    if (part.type === "newline") push("", "\n");
    else if (part.type === "energy" || part.type === "star") push(`d${i}`, ICON_CHAR, part.type);
    else push(`d${i}`, part.text);
  });
  if (post.length > 0) push("", "\n");
  post.forEach(keyword);
  return { slots, plain, icons };
}

export function normalizeProposal(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** Words that light up icons instead of text: the ENERGY keyword and the Regent's star. */
export const ICON_WORDS: Record<"energy" | "star", string> = { energy: "에너지", star: "별" };

/** Every text offset a proposal reveals; spaces also match line breaks. Empty means the card does not say it. */
export function matchProposal(text: CardText, proposal: string): number[] {
  const query = normalizeProposal(proposal);
  if (!query) return [];
  const pattern = new RegExp(
    query.split(" ").map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+"),
    "g",
  );
  const hits = new Set<number>();
  for (const match of text.plain.matchAll(pattern)) {
    for (let i = 0; i < match[0].length; i += 1) {
      if (!/\s/.test(match[0][i])) hits.add((match.index ?? 0) + i);
    }
  }
  for (const icon of ["energy", "star"] as const) {
    if (query === ICON_WORDS[icon]) text.icons[icon].forEach((offset) => hits.add(offset));
  }
  return [...hits].sort((a, b) => a - b);
}

export interface Knowledge {
  hints: Partial<Record<HintKey, string>>;
  present: string[];
  absent: string[];
  wrongGuesses: string[];
}

export type ConflictReason = HintKey | "text" | "guessed";

/** Why a card cannot be the answer given what the player has learned. Empty means it still fits. */
export function conflicts(card: CodexCard, text: CardText, known: Knowledge): ConflictReason[] {
  const reasons: ConflictReason[] = [];
  for (const key of HINT_KEYS) {
    const value = known.hints[key];
    if (value !== undefined && hintValue(card, key) !== value) reasons.push(key);
  }
  if (
    known.present.some((word) => matchProposal(text, word).length === 0)
    || known.absent.some((word) => matchProposal(text, word).length > 0)
  ) reasons.push("text");
  if (known.wrongGuesses.includes(card.id)) reasons.push("guessed");
  return reasons;
}

/** Score of a finished round; actions are proposals and guesses, the winning guess included. */
export function roundScore(round: { solved: boolean; hints: number; actions: number; livesLost: number }): number {
  if (!round.solved) return 0;
  return Math.max(
    SCORE.floor,
    SCORE.start
      - round.hints * SCORE.hint
      - Math.max(0, round.actions - 1) * SCORE.action
      - round.livesLost * SCORE.life,
  );
}
