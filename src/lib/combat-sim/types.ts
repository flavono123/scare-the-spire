/**
 * Combat simulator types: the input schema, the per-version catalog the engine
 * reads, the engine state, and the events it emits.
 *
 * The simulator is a dev-only tool (/dev/combat-sim). Nothing here may be
 * imported from a production route.
 */

/** A card in an input pile: `PREPARED+` is Prepared upgraded, `STRIKE_SILENT*5` repeats it. */
export type CardSpec = string;

/** `GRASP_POWER`, `GRASP_POWER:2`, or `{ id, amount }`. */
export type PowerSpec = string | { id: string; amount?: number };

export type SimAction =
  /** Play a card from hand. `card` matches the first hand card with that id and upgrade state. */
  | { do: "play"; card: string; index?: number; target?: string | number; choose?: CardSpec[] }
  /** End the player turn: the hand is discarded (Retain stays, Ethereal is exhausted). */
  | { do: "endTurn" }
  /** Every living monster runs its current move, then advances its move graph. */
  | { do: "monsterTurn" }
  /** Start a player turn: block clears, energy refills to max, draw 5. */
  | { do: "startTurn" }
  /** A card enters combat (generated, shuffled in): runs AfterCardEnteredCombat. */
  | { do: "addCard"; card: CardSpec; pile?: PileType }
  | { do: "wait"; ms: number };

/** The only input: top-level axes, given as one JSON object or as URL query keys. */
export interface CombatSimInput {
  /** Game version, e.g. "0.102.0". */
  version: string;
  /** Character id, e.g. "SILENT". */
  character: string;
  /** Encounter id, e.g. "DOORMAKER_BOSS". */
  encounter: string;
  energy?: number;
  maxEnergy?: number;
  /** Player current HP (defaults to the character's starting HP). */
  hp?: number;
  hand?: CardSpec[];
  /** Index 0 is the top of the draw pile: draws take cards in this order. */
  drawPile?: CardSpec[];
  discardPile?: CardSpec[];
  exhaustPile?: CardSpec[];
  /** Powers present from the start, keyed by `player`, a monster id, or a monster index. */
  powers?: Record<string, PowerSpec[]>;
  /** Current move per monster (id or index); defaults to the move graph's initial move. */
  moves?: Record<string, string>;
  /** Accepted and ignored for now. */
  relics?: string[];
  /** Seed for shuffles (only used when an empty draw pile must reshuffle the discard pile). */
  seed?: number;
  script?: SimAction[];
}

export type SimCardType = "Attack" | "Skill" | "Power" | "Status" | "Curse" | "Quest" | "Other";
export type SimKeyword = "Exhaust" | "Unplayable" | "Ethereal" | "Retain" | "Innate" | "Sly" | "Eternal";

export interface SimCardDef {
  id: string;
  name: string;
  type: SimCardType;
  /** Game TargetType: Self, AnyEnemy, AllEnemies, ... */
  target: string;
  cost: number;
  isXCost: boolean;
  vars: Record<string, number>;
  /** Site upgrade map: lowercase var keys with "+N" deltas, `cost` absolute, `add_*` / `remove_*` keywords. */
  upgrade: Record<string, string | number> | null;
  keywords: SimKeyword[];
}

export interface SimIntentDef {
  type: string;
  damage?: number;
  repeat?: number;
}

export interface SimMoveDef {
  id: string;
  name: string | null;
  intents: SimIntentDef[];
}

export interface SimMonsterDef {
  id: string;
  name: string;
  hp: number;
  moves: Record<string, SimMoveDef>;
  initialMove: string | null;
  transitions: { from: string; to: string; weight: number }[];
}

export interface SimPowerDef {
  id: string;
  name: string;
  description: string;
}

export interface SimAfflictionDef {
  id: string;
  name: string;
  description: string;
  /** Text the game adds under the card description (`HasExtraCardText`). */
  extraCardText: string | null;
}

export interface SimCharacterDef {
  id: string;
  name: string;
  hp: number;
  maxEnergy: number;
}

export interface SimEncounterDef {
  id: string;
  name: string;
  monsters: { monsterId: string; slot: string | null }[];
}

/** Everything the engine needs for one version. Built server-side by catalog.ts. */
export interface SimCatalog {
  version: string;
  character: SimCharacterDef;
  encounter: SimEncounterDef;
  cards: Record<string, SimCardDef>;
  monsters: Record<string, SimMonsterDef>;
  powers: Record<string, SimPowerDef>;
  afflictions: Record<string, SimAfflictionDef>;
}

export type PileType = "draw" | "hand" | "discard" | "exhaust" | "play";
export const PILE_TYPES: readonly PileType[] = ["hand", "draw", "discard", "exhaust", "play"];

export interface SimCard {
  uid: string;
  id: string;
  upgraded: boolean;
  affliction: { id: string; amount: number } | null;
}

export interface SimPower {
  id: string;
  amount: number;
}

export interface SimCreature {
  /** `player`, or `m0`, `m1`, ... in encounter order. */
  key: string;
  id: string;
  hp: number;
  maxHp: number;
  block: number;
  powers: SimPower[];
}

export interface SimMonster extends SimCreature {
  slot: string | null;
  moveId: string | null;
}

export interface SimState {
  turn: number;
  energy: number;
  maxEnergy: number;
  piles: Record<PileType, string[]>;
  cards: Record<string, SimCard>;
  player: SimCreature;
  monsters: SimMonster[];
  rng: number;
}

export type SimEvent =
  | { kind: "energy"; from: number; to: number; cause: "cost" | "affliction" | "power" | "turn"; sourceId?: string; uid?: string }
  /** The player picks the card up (hover/drag) before PlayCardAction pays for it. */
  | { kind: "select"; uid: string }
  | { kind: "move"; uid: string; from: PileType; to: PileType; cause: "play" | "draw" | "discard" | "result" | "exhaust" | "shuffle" | "endTurn" }
  | { kind: "enter"; uid: string; to: PileType }
  | { kind: "remove"; uid: string; from: PileType }
  | { kind: "afflict"; uid: string; afflictionId: string; amount: number; sourceId: string }
  | { kind: "clearAffliction"; uid: string; afflictionId: string }
  | { kind: "afflictionTrigger"; uid: string; afflictionId: string; amount: number }
  | { kind: "power"; creature: string; powerId: string; amount: number; change: "applied" | "removed" }
  | { kind: "damage"; creature: string; amount: number; blocked: number; hpFrom: number; hpTo: number; source: string }
  | { kind: "block"; creature: string; amount: number; total: number }
  | { kind: "animate"; creature: string; animation: "cast" | "attack" | "hurt" }
  | { kind: "intent"; creature: string; moveId: string | null }
  | { kind: "shuffle"; count: number }
  | { kind: "wait"; ms: number }
  | { kind: "unimplemented"; what: string }
  | { kind: "rejected"; reason: string };

export interface SimStep {
  /** Index into `input.script`; -1 for combat setup. */
  action: number;
  event: SimEvent;
  /** State after the event. */
  state: SimState;
}

export interface SimResult {
  initial: SimState;
  /** State after setup (initial powers applied), before the first action. */
  start: SimState;
  steps: SimStep[];
  final: SimState;
  warnings: string[];
}
