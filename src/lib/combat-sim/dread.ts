/**
 * Dread boss dominions (`Models/Dread/Dominions/<Boss>Dominion.cs`, applied by
 * `DreadRunModel.ApplyCurrentDominion` from the act's boss encounter's `GetDominion()`), as the powers and
 * cards each one puts on a combat. Read from the 0.113.0 source; `scripts/combat-sim.spec.ts` checks each
 * entry against the archived file when the archive is there.
 *
 * Where a dominion's own power acts turn by turn (Lagavulin Matriarch, Aeonglass, ...), that happens in
 * `hooks.ts` only for the powers listed there; the rest are shown on the creature and reported as not simulated.
 */

import type { SimDominionDef, SimDominionPower } from "./types";

interface DominionRule {
  /** Dominion class without `Dominion`, as an id. */
  id: string;
  /** Boss encounter whose `GetDominion()` returns it. */
  boss: string;
  player?: SimDominionPower[];
  /** Powers on every enemy; `amount` may depend on the encounter. */
  enemies?: (encounter: EncounterFacts) => SimDominionPower[];
  drawPileCards?: string[];
  chooseScreen?: string[];
}

export interface EncounterFacts {
  id: string;
  roomType: string | null;
  isWeak: boolean;
  /** Monsters generated for the encounter (`MonstersWithSlots.Count`). */
  monsterCount: number;
}

const on = (powerId: string, amount: number): SimDominionPower => ({ powerId, amount });

export const DOMINION_RULES: DominionRule[] = [
  // AeonglassDominion: AeonglassDominionPower 1 on the players (it adds Wither: AfterRoomEntered).
  { id: "AEONGLASS", boss: "AEONGLASS_BOSS", player: [on("AEONGLASS_DOMINION_POWER", 1)] },
  // CeremonialBeastDominion: RitualPower 1 on every enemy that enters combat.
  { id: "CEREMONIAL_BEAST", boss: "CEREMONIAL_BEAST_BOSS", enemies: () => [on("RITUAL_POWER", 1)] },
  // InsatiableDominion: InsatiableDominionPower 1 on the players.
  { id: "INSATIABLE", boss: "THE_INSATIABLE_BOSS", player: [on("INSATIABLE_DOMINION_POWER", 1)] },
  // KaiserCrabDominion: PlatingPower 7 on every enemy.
  { id: "KAISER_CRAB", boss: "KAISER_CRAB_BOSS", enemies: () => [on("PLATING_POWER", 7)] },
  // KinDominion: WeakPower 2 and FrailPower 2 on the players.
  { id: "KIN", boss: "THE_KIN_BOSS", player: [on("WEAK_POWER", 2), on("FRAIL_POWER", 2)] },
  // KnowledgeDemonDominion: before the first draw (turn 1) FromChooseACardScreen(Sloth, Amnesia).
  { id: "KNOWLEDGE_DEMON", boss: "KNOWLEDGE_DEMON_BOSS", chooseScreen: ["SLOTH", "AMNESIA"] },
  // LagavulinMatriarchDominion: LagavulinMatriarchDominionPower 1 on the players (-1 Strength and Dexterity at the end of their first turn).
  { id: "LAGAVULIN_MATRIARCH", boss: "LAGAVULIN_MATRIARCH_BOSS", player: [on("LAGAVULIN_MATRIARCH_DOMINION_POWER", 1)] },
  // QueenDominion: YouAreMinePower 3 on the players.
  { id: "QUEEN", boss: "QUEEN_BOSS", player: [on("YOU_ARE_MINE_POWER", 3)] },
  // SoulFyshDominion: one Beckon in the draw pile at a random position.
  { id: "SOUL_FYSH", boss: "SOUL_FYSH_BOSS", drawPileCards: ["BECKON"] },
  // TestSubjectDominion: StrengthPower 3 on every enemy.
  { id: "TEST_SUBJECT", boss: "TEST_SUBJECT_BOSS", enemies: () => [on("STRENGTH_POWER", 3)] },
  // VantomDominion: SlipperyPower on every enemy, 2 in an elite room, else 1.
  { id: "VANTOM", boss: "VANTOM_BOSS", enemies: (encounter) => [on("SLIPPERY_POWER", encounter.roomType === "Elite" ? 2 : 1)] },
  // WaterfallGiantDominion: ExplosivePower on every enemy: GetExplosiveAmount(encounter).
  {
    id: "WATERFALL_GIANT",
    boss: "WATERFALL_GIANT_BOSS",
    enemies: (encounter) => [on("EXPLOSIVE_POWER", encounter.monsterCount > 1 ? 3 : encounter.isWeak ? 4 : encounter.roomType === "Elite" ? 7 : 5)],
  },
];

/** `THE_KIN_BOSS`, `KIN`, `the-kin` and `KinDominion` all name the same dominion. */
function normalize(text: string): string {
  return text
    .toUpperCase()
    .replace(/[-\s]/g, "_")
    .replace(/(?:_BOSS|_DOMINION|BOSS|DOMINION)$/, "")
    .replace(/^THE_/, "");
}

export function findDominionRule(name: string): DominionRule | null {
  const wanted = normalize(name);
  return DOMINION_RULES.find((rule) => normalize(rule.id) === wanted || normalize(rule.boss) === wanted) ?? null;
}

export function dominionFor(rule: DominionRule, encounter: EncounterFacts): SimDominionDef {
  return {
    id: rule.id,
    boss: rule.boss,
    player: rule.player ?? [],
    enemies: rule.enemies?.(encounter) ?? [],
    drawPileCards: rule.drawPileCards ?? [],
    chooseScreen: rule.chooseScreen ?? null,
  };
}
