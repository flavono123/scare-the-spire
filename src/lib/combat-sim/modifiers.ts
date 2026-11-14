/**
 * Damage and block as the powers on the creatures change them (`Hook.ModifyDamage`: additive first, then
 * multiplicative): the dealer's Strength adds, its Weak takes a quarter off, the target's Vulnerable adds
 * half; block takes the owner's Dexterity, then Frail's quarter off. The result is rounded down and never
 * below 0 (the game's final rounding was not read, so a fraction may differ by 1). Relics, enchantments and
 * the other modifiers (Vigor, Intangible, ...) are not applied.
 */

import type { SimPower } from "./types";

const amountOf = (powers: SimPower[], id: string): number => powers.find((power) => power.id === id)?.amount ?? 0;

export function modifiedDamage(base: number, dealer: SimPower[], target: SimPower[]): number {
  let value = base + amountOf(dealer, "STRENGTH_POWER");
  if (amountOf(dealer, "WEAK_POWER") > 0) value *= 0.75;
  if (amountOf(target, "VULNERABLE_POWER") > 0) value *= 1.5;
  return Math.max(0, Math.floor(value));
}

export function modifiedBlock(base: number, owner: SimPower[]): number {
  let value = base + amountOf(owner, "DEXTERITY_POWER");
  if (amountOf(owner, "FRAIL_POWER") > 0) value *= 0.75;
  return Math.max(0, Math.floor(value));
}

/** Whether any power on these creatures changes damage or block, for the one-line "not exact" note. */
export const MODIFIER_POWERS = ["STRENGTH_POWER", "WEAK_POWER", "VULNERABLE_POWER", "DEXTERITY_POWER", "FRAIL_POWER"];
