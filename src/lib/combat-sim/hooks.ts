/**
 * Power and affliction hooks for the combat simulator, read from the archived
 * build source. Only the hooks listed here run; any other power is carried in
 * state and drawn, but does nothing.
 */

import type { SimCard, SimCreature, SimPower } from "./types";

/** Commands a hook may run. Each one emits engine events. */
export interface HookContext {
  /** Every card the player owns in combat: hand, draw, discard, exhaust, play (`PlayerCombatState.AllCards`). */
  allCards(): SimCard[];
  afflict(card: SimCard, afflictionId: string, amount: number, sourceId: string): void;
  clearAffliction(card: SimCard): void;
  /** `CreatureCmd.GainBlock(creature, amount, Unpowered)`. */
  gainBlock(creature: SimCreature, amount: number): void;
  applyPower(owner: SimCreature, spec: { id: string; amount: number }): void;
  /** `PowerCmd.ModifyAmount`: adds `delta`; a power that reaches 0 (or goes negative when it cannot) is removed. */
  changePowerAmount(owner: SimCreature, powerId: string, delta: number): void;
  removePower(owner: SimCreature, powerId: string): void;
  /** `CombatState.RoundNumber`: 1 on the first player turn. */
  round(): number;
  /** `PlayerCmd.LoseEnergy`: energy never drops below 0. */
  loseEnergy(amount: number, cause: "affliction" | "power", sourceId: string, uid?: string): void;
}

export interface PowerHooks {
  source: string;
  /** Builds the rule was checked against (inclusive); outside them the hook still runs but warns. */
  checkedVersions: string[];
  afterApplied?(ctx: HookContext, owner: SimCreature, power: SimPower): void;
  afterRemoved?(ctx: HookContext, owner: SimCreature, power: SimPower): void;
  afterCardEnteredCombat?(ctx: HookContext, owner: SimCreature, power: SimPower, card: SimCard): void;
  beforeCardPlayed?(ctx: HookContext, owner: SimCreature, power: SimPower, card: SimCard): void;
  afterCardPlayed?(ctx: HookContext, owner: SimCreature, power: SimPower, card: SimCard): void;
}

export interface AfflictionHooks {
  source: string;
  checkedVersions: string[];
  /** Runs after the card reaches the play pile and before its own OnPlay (`CardModel.OnPlayWrapper`). */
  onPlay?(ctx: HookContext, card: SimCard, amount: number): void;
}

/** Builds whose GraspPower.cs / Weighted.cs match 0.102.0 byte for byte. */
const GRASP_WEIGHTED_BUILDS = ["0.102.0", "0.103.0", "0.103.1", "0.103.2", "0.103.3", "0.104.0"];

export const POWER_HOOKS: Record<string, PowerHooks> = {
  GRASP_POWER: {
    source: "MegaCrit.Sts2.Core.Models.Powers/GraspPower.cs",
    checkedVersions: GRASP_WEIGHTED_BUILDS,
    // For every player ally, CardCmd.Afflict<Weighted>(card, Amount) on each card with no affliction.
    afterApplied(ctx, _owner, power) {
      for (const card of ctx.allCards()) {
        if (!card.affliction) ctx.afflict(card, "WEIGHTED", power.amount, "GRASP_POWER");
      }
    },
    afterCardEnteredCombat(ctx, _owner, power, card) {
      if (!card.affliction) ctx.afflict(card, "WEIGHTED", power.amount, "GRASP_POWER");
    },
    // CardCmd.ClearAffliction on every card whose affliction is Weighted.
    afterRemoved(ctx) {
      for (const card of ctx.allCards()) {
        if (card.affliction?.id === "WEIGHTED") ctx.clearAffliction(card);
      }
    },
  },
};

export const AFFLICTION_HOOKS: Record<string, AfflictionHooks> = {
  WEIGHTED: {
    source: "MegaCrit.Sts2.Core.Models.Afflictions/Weighted.cs",
    checkedVersions: GRASP_WEIGHTED_BUILDS,
    // PlayerCmd.LoseEnergy(Amount, Card.Owner)
    onPlay(ctx, card, amount) {
      ctx.loseEnergy(amount, "affliction", "WEIGHTED", card.uid);
    },
  },
};

/** Which side's turn is running, and which side the power's owner is on. */
export interface SideTurn {
  side: "player" | "enemy";
  ownerSide: "player" | "enemy";
}

export type SideTurnHook = (ctx: HookContext, owner: SimCreature, power: SimPower, turn: SideTurn) => void;

export interface SideTurnHooks {
  source: string;
  checkedVersions: string[];
  beforeSideTurnEndEarly?: SideTurnHook;
  afterSideTurnEnd?: SideTurnHook;
  afterSideTurnStart?: SideTurnHook;
}

const SIDE_TURN_BUILDS = ["0.113.0"];

/** `PowerModel` overrides of `BeforeSideTurnEndEarly`, `AfterSideTurnEnd` and `AfterSideTurnStart` (0.113.0 source). */
export const SIDE_TURN_HOOKS: Record<string, SideTurnHooks> = {
  PLATING_POWER: {
    source: "MegaCrit.Sts2.Core.Models.Powers/PlatingPower.cs",
    checkedVersions: SIDE_TURN_BUILDS,
    // BeforeSideTurnEndEarly: the owner's side ends its turn -> GainBlock(Amount).
    beforeSideTurnEndEarly(ctx, owner, power, turn) {
      if (turn.side === turn.ownerSide) ctx.gainBlock(owner, power.amount);
    },
    // AfterSideTurnStart: the owner's side starts a turn after round 1 -> ModifyAmount(-Decrement), Decrement = the player count (1).
    afterSideTurnStart(ctx, owner, power, turn) {
      if (turn.side === turn.ownerSide && ctx.round() > 1) ctx.changePowerAmount(owner, power.id, -1);
    },
  },
  LAGAVULIN_MATRIARCH_DOMINION_POWER: {
    source: "MegaCrit.Sts2.Core.Models.Powers/LagavulinMatriarchDominionPower.cs",
    checkedVersions: SIDE_TURN_BUILDS,
    // AfterSideTurnEnd: the player's turn ends -> -Amount Strength and Dexterity, then the power is removed.
    afterSideTurnEnd(ctx, owner, power, turn) {
      if (turn.side !== "player" || turn.ownerSide !== "player") return;
      ctx.applyPower(owner, { id: "STRENGTH_POWER", amount: -power.amount });
      ctx.applyPower(owner, { id: "DEXTERITY_POWER", amount: -power.amount });
      ctx.removePower(owner, power.id);
    },
  },
  // Weak, Vulnerable and Frail: AfterSideTurnEnd(Enemy) -> TickDownDuration, on whoever carries them.
  WEAK_POWER: tickDown("WeakPower"),
  VULNERABLE_POWER: tickDown("VulnerablePower"),
  FRAIL_POWER: tickDown("FrailPower"),
};

function tickDown(file: string): SideTurnHooks {
  return {
    source: `MegaCrit.Sts2.Core.Models.Powers/${file}.cs`,
    checkedVersions: SIDE_TURN_BUILDS,
    afterSideTurnEnd(ctx, owner, power, turn) {
      if (turn.side === "enemy") ctx.changePowerAmount(owner, power.id, -1);
    },
  };
}
