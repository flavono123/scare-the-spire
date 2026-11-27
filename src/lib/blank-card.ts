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
/** Tunable playtest scoring. Unused hints share `hints` by how much each one would have told. */
export const SCORE = { solved: 300, hints: 400, life: 100, attempt: 25, holeInOne: 100 } as const;
/** A proposal that this share of the answer pool says gives positions away for free ("니다"). */
export const FREE_PROPOSAL_SHARE = 0.75;

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

/** Points an unused hint is worth: `SCORE.hints` split by each hint's entropy over the answer pool. */
export function hintPoints(cards: CodexCard[]): Record<HintKey, number> {
  const entropy = (key: HintKey) => {
    const counts = new Map<string, number>();
    cards.forEach((card) => counts.set(hintValue(card, key), (counts.get(hintValue(card, key)) ?? 0) + 1));
    return [...counts.values()].reduce((sum, n) => sum - (n / cards.length) * Math.log2(n / cards.length), 0);
  };
  const bits = Object.fromEntries(HINT_KEYS.map((key) => [key, entropy(key)])) as Record<HintKey, number>;
  const total = HINT_KEYS.reduce((sum, key) => sum + bits[key], 0);
  return Object.fromEntries(
    HINT_KEYS.map((key) => [key, Math.round((SCORE.hints * bits[key]) / total / 10) * 10]),
  ) as Record<HintKey, number>;
}

/** Proposals refused without a cost: one Hangul syllable, or text nearly every answer says. */
export function isRefusedProposal(proposal: string, pool: CardText[]): boolean {
  const query = normalizeProposal(proposal);
  if (/^[가-힣]$/.test(query)) return true;
  const saying = pool.filter((text) => matchProposal(text, query).length > 0).length;
  return saying >= pool.length * FREE_PROPOSAL_SHARE;
}

export interface Round {
  solved: boolean;
  hintsUsed: HintKey[];
  /** 문구 시도 */
  attempts: number;
  /** 정답 제출, the winning one included */
  submissions: number;
  livesLeft: number;
}

export interface ScoreLine {
  key: string;
  label: string;
  /** Count shown beside the label (×n), when the line is per item. */
  count?: number;
  hint?: HintKey;
  value: number;
}

/** Run-end style score lines of a finished round; a failed round scores nothing. */
export function scoreLines(round: Round, points: Record<HintKey, number>): ScoreLine[] {
  if (!round.solved) return [{ key: "failed", label: "실패", value: 0 }];
  const lines: ScoreLine[] = [{ key: "solved", label: "정답", value: SCORE.solved }];
  for (const key of HINT_KEYS) {
    if (!round.hintsUsed.includes(key)) lines.push({ key: `hint-${key}`, label: "아낀 힌트", hint: key, value: points[key] });
  }
  if (round.livesLeft > 0) {
    lines.push({ key: "lives", label: "남은 라이프", count: round.livesLeft, value: round.livesLeft * SCORE.life });
  }
  if (round.attempts > 0) {
    lines.push({ key: "attempts", label: "문구 시도", count: round.attempts, value: -round.attempts * SCORE.attempt });
  }
  if (round.attempts === 0 && round.submissions === 1 && round.hintsUsed.length === 0) {
    lines.push({ key: "hole-in-one", label: "홀인원", value: SCORE.holeInOne });
  }
  return lines;
}

export function totalScore(lines: ScoreLine[]): number {
  return Math.max(0, lines.reduce((sum, line) => sum + line.value, 0));
}
