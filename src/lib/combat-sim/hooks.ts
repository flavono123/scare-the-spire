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
