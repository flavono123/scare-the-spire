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

/**
 * Optional scene parts. The encounter (background, monsters, intents, monster
 * health) is always there; `player` adds the character with its health bar,
 * `cards` adds the card interface (hand, piles, energy, card play).
 */
export type ScenePart = "player" | "cards";
export const SCENE_PARTS: readonly ScenePart[] = ["player", "cards"];

/** Game speed setting (FastModeType): Normal is the default, Fast and Instant shorten or skip waits. */
export type SimSpeed = "normal" | "fast" | "instant";
export const SIM_SPEEDS: readonly SimSpeed[] = ["normal", "fast", "instant"];

/** The only input: top-level axes, given as one JSON object or as URL query keys. */
export interface CombatSimInput {
  /** Game version, e.g. "0.102.0". */
  version: string;
  /** Character id, e.g. "SILENT". Required by the `player` and `cards` parts. */
  character?: string;
  /** Encounter id, e.g. "DOORMAKER_BOSS". */
  encounter: string;
  /**
   * Scene parts to show and load. Defaults to both with a character, none
   * without one (an encounter-only scene). `[]` shows the encounter alone.
   */
  parts?: ScenePart[];
  /** Game speed (settings FastMode). Changes only timing, never the resulting state. Default "normal". */
  speed?: SimSpeed;
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
  /** `WithAttackerAnim(name, delay)` seconds in the move's source (0 when the move does not set it). */
  attackAnimDelay: number;
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
  /** CharacterModel.AttackAnimDelay seconds (AttackCommand.FromCard). */
  attackAnimDelay: number;
}

export interface SimEncounterDef {
  id: string;
  name: string;
  monsters: { monsterId: string; slot: string | null }[];
}

/** Everything the engine needs for one version. Built server-side by catalog.ts. */
export interface SimCatalog {
  version: string;
  /** Null when the scene loads no character (no `player` or `cards` part). */
  character: SimCharacterDef | null;
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
  /**
   * `awaited` on a play move: AddDuringManualCardPlay waits for the play-pile
   * tween only for Power cards; other cards start their effect while it flies.
   */
  | { kind: "move"; uid: string; from: PileType; to: PileType; cause: "play" | "draw" | "discard" | "result" | "exhaust" | "shuffle" | "endTurn"; awaited?: boolean }
  | { kind: "enter"; uid: string; to: PileType }
  | { kind: "remove"; uid: string; from: PileType }
  | { kind: "afflict"; uid: string; afflictionId: string; amount: number; sourceId: string }
  | { kind: "clearAffliction"; uid: string; afflictionId: string }
  | { kind: "afflictionTrigger"; uid: string; afflictionId: string; amount: number }
  | { kind: "power"; creature: string; powerId: string; amount: number; change: "applied" | "removed" }
  | { kind: "damage"; creature: string; amount: number; blocked: number; hpFrom: number; hpTo: number; source: string }
  | { kind: "block"; creature: string; amount: number; total: number }
  /** CreatureCmd.TriggerAnim: waits `delayMs` (Normal) / min(delay / 2, 250 ms) (Fast) / 0 (Instant). */
  | { kind: "animate"; creature: string; animation: "cast" | "attack" | "hurt"; delayMs: number }
  /**
   * Cmd.CustomScaledWait(fast, normal): Instant waits 0. With `sincePlayMove`, the
   * time since that step's play move finished is subtracted (OnPlayWrapper's
   * CustomScaledWait(0.15 - elapsed, 0.3 - elapsed)).
   */
  | { kind: "pause"; reason: string; fastMs: number; normalMs: number; sincePlayMove?: number }
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
