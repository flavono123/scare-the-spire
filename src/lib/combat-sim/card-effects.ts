/**
 * Card effect recipes for the combat simulator.
 *
 * Each recipe is the card's `OnPlay` body read from the archived build source
 * (`~/sts2-builds/<version>/src/MegaCrit.Sts2.Core.Models.Cards/<Card>.cs`),
 * reduced to the few commands the engine runs. Numbers are never written here:
 * `{ var }` reads the card's versioned DynamicVars (after upgrade). A card with
 * no recipe still pays its cost and moves to its result pile; its effect is
 * reported as unimplemented.
 */

export type CountRef = number | { var: string };

export type CardOp =
  /**
   * `DamageCmd.Attack(DynamicVars.<var>.BaseValue).FromCard(this).Targeting(cardPlay.Target)`;
   * `normalAnimExtra` (s) is added to the attacker's anim delay when FastMode is Normal.
   */
  | { op: "damage"; var: string; target: "target" | "allEnemies"; normalAnimExtra?: number }
  /** `CreatureCmd.GainBlock(Owner.Creature, DynamicVars.<var>, cardPlay)` */
  | { op: "block"; var: string }
  /** `CardPileCmd.Draw(choiceContext, <count>, Owner)` */
  | { op: "draw"; count: CountRef }
  /** `CardSelectCmd.FromHandForDiscard(..., new CardSelectorPrefs(DiscardSelectionPrompt, <count>))` then `CardCmd.Discard` */
  | { op: "discardChoice"; count: CountRef }
  /** A command the engine does not run yet; shown as unimplemented. */
  | { op: "unimplemented"; what: string };

export interface CardRecipe {
  /** Archive source file the ops were read from (0.102.0). */
  source: string;
  ops: CardOp[];
}

const CARDS_DIR = "MegaCrit.Sts2.Core.Models.Cards";

const strike = (file: string): CardRecipe => ({
  source: `${CARDS_DIR}/${file}.cs`,
  ops: [{ op: "damage", var: "Damage", target: "target" }],
});

const defend = (file: string): CardRecipe => ({
  source: `${CARDS_DIR}/${file}.cs`,
  ops: [{ op: "block", var: "Block" }],
});

export const CARD_RECIPES: Record<string, CardRecipe> = {
  // Draw(Cards.BaseValue), then FromHandForDiscard(1) and Discard.
  ACROBATICS: {
    source: `${CARDS_DIR}/Acrobatics.cs`,
    ops: [{ op: "draw", count: { var: "Cards" } }, { op: "discardChoice", count: 1 }],
  },
  // cardCount = Cards.IntValue; Draw(cardCount), then FromHandForDiscard(cardCount) and Discard.
  PREPARED: {
    source: `${CARDS_DIR}/Prepared.cs`,
    ops: [{ op: "draw", count: { var: "Cards" } }, { op: "discardChoice", count: { var: "Cards" } }],
  },
  // GainBlock(Block), then FromHandForDiscard(1) and Discard.
  SURVIVOR: {
    source: `${CARDS_DIR}/Survivor.cs`,
    ops: [{ op: "block", var: "Block" }, { op: "discardChoice", count: 1 }],
  },
  // Attack(Damage) on the target with WithAttackerAnim("Attack", AttackAnimDelay
  // + 0.2 s when FastMode is Normal), then PowerCmd.Apply<WeakPower>(target, Weak).
  NEUTRALIZE: {
    source: `${CARDS_DIR}/Neutralize.cs`,
    ops: [{ op: "damage", var: "Damage", target: "target", normalAnimExtra: 0.2 }, { op: "unimplemented", what: "WEAK_POWER 부여" }],
  },
  STRIKE_IRONCLAD: strike("StrikeIronclad"),
  STRIKE_SILENT: strike("StrikeSilent"),
  STRIKE_DEFECT: strike("StrikeDefect"),
  STRIKE_REGENT: strike("StrikeRegent"),
  STRIKE_NECROBINDER: strike("StrikeNecrobinder"),
  DEFEND_IRONCLAD: defend("DefendIronclad"),
  DEFEND_SILENT: defend("DefendSilent"),
  DEFEND_DEFECT: defend("DefendDefect"),
  DEFEND_REGENT: defend("DefendRegent"),
  DEFEND_NECROBINDER: defend("DefendNecrobinder"),
};

export function resolveCount(count: CountRef, vars: Record<string, number>): number {
  if (typeof count === "number") return count;
  return Math.max(0, Math.trunc(vars[count.var] ?? 0));
}
