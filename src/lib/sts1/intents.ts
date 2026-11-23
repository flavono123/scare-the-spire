import { cache } from "react";
import { readFile } from "fs/promises";
import path from "path";
import type { GameLocale } from "@/lib/i18n";
import { getSts1Monsters } from "./data";
import { sts1GameLocale } from "./locale";
import { sts1IntentImageName } from "./monster-moves";
import type { Sts1MonsterMoveTier } from "./types";

/** AbstractMonster.Intent values a monster can show, in the enum's order (DEBUG and NONE draw nothing). */
export const STS1_INTENTS = [
  "ATTACK", "ATTACK_BUFF", "ATTACK_DEBUFF", "ATTACK_DEFEND", "BUFF", "DEBUFF", "STRONG_DEBUFF",
  "DEFEND", "DEFEND_DEBUFF", "DEFEND_BUFF", "ESCAPE", "MAGIC", "SLEEP", "STUN", "UNKNOWN",
] as const;
export type Sts1IntentId = (typeof STS1_INTENTS)[number];

// AbstractMonster.updateIntentTip: the TEXT entries each intent's PowerTip is built from.
// "X" stands where the game appends the damage (single-hit wording).
const TIP_PARTS: Record<Sts1IntentId, { header: number; body: (number | "X")[] }> = {
  ATTACK: { header: 0, body: [4, "X", 5] },
  ATTACK_BUFF: { header: 6, body: [9, "X", 5] },
  ATTACK_DEBUFF: { header: 10, body: [11, "X", 5] },
  ATTACK_DEFEND: { header: 0, body: [12, "X", 5] },
  BUFF: { header: 10, body: [19] },
  DEBUFF: { header: 10, body: [20] },
  STRONG_DEBUFF: { header: 10, body: [21] },
  DEFEND: { header: 13, body: [22] },
  DEFEND_DEBUFF: { header: 13, body: [23] },
  DEFEND_BUFF: { header: 13, body: [24] },
  ESCAPE: { header: 14, body: [25] },
  MAGIC: { header: 15, body: [26] },
  SLEEP: { header: 16, body: [27] },
  STUN: { header: 17, body: [28] },
  UNKNOWN: { header: 18, body: [29] },
};

export interface Sts1Intent {
  id: Sts1IntentId;
  slug: string;
  name: string;
  nameEn: string;
  description: string;
  image: string;
  /** Monsters with a move that shows this intent, and those moves' names. */
  users: { slug: string; name: string; moves: string[] }[];
}

async function tipTable(gameLocale: GameLocale): Promise<string[]> {
  const file = path.join(process.cwd(), "data/sts1/localization", sts1GameLocale(gameLocale), "intent-tips.json");
  return (JSON.parse(await readFile(file, "utf8")) as { TEXT: string[] }).TEXT;
}

function tipText(table: readonly string[], parts: readonly (number | "X")[]): string {
  return parts.map((part) => (part === "X" ? "X" : table[part] ?? "")).join("").trim();
}

export const getSts1Intents = cache(async (gameLocale: GameLocale = "kor"): Promise<Sts1Intent[]> => {
  const [table, eng, monsters] = await Promise.all([tipTable(gameLocale), tipTable("eng"), getSts1Monsters(gameLocale)]);
  return STS1_INTENTS.map((id) => {
    const parts = TIP_PARTS[id];
    const users = monsters.flatMap((monster) => {
      const moves = monster.moves.filter((move) => move.tiers.some((tier) => tier.intent === id));
      return moves.length ? [{ slug: monster.slug, name: monster.name, moves: moves.map((move) => move.name ?? move.key ?? "").filter(Boolean) }] : [];
    });
    const sample: Pick<Sts1MonsterMoveTier, "intent" | "damage" | "multiplier"> = { intent: id, damage: 6, multiplier: 1 };
    return {
      id,
      slug: id.toLowerCase().replace(/_/g, "-"),
      name: table[parts.header] ?? id,
      nameEn: eng[parts.header] ?? id,
      description: tipText(table, parts.body),
      image: sts1IntentImageName(sample) ?? "unknown",
      users,
    };
  });
});
