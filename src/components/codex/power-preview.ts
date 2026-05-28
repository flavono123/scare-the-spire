"use client";

import { bakeDescription } from "@/lib/codex-bake";
import type { CodexPower, DamageValue } from "@/lib/codex-types";
import { getEffectiveDamageValue, MONSTER_MOVE_ASCENSION_LEVEL } from "./monster-ascension";

export function bakePowerAmountDescription(
  descriptionRaw: string | null | undefined,
  vars: Record<string, number | string> | null | undefined,
  amount: DamageValue | null | undefined,
  ascensionLevel = 0,
  ascensionThreshold = MONSTER_MOVE_ASCENSION_LEVEL,
): string | null {
  if (!descriptionRaw?.includes("{Amount}")) return null;
  const amountValue = getEffectiveDamageValue(amount ?? null, ascensionLevel, ascensionThreshold);
  if (amountValue == null) return null;

  return bakeDescription(descriptionRaw, {
    ...(vars ?? {}),
    Amount: amountValue,
  });
}

export function applyPowerAmountForPreview(
  power: CodexPower,
  amount: DamageValue | null | undefined,
  ascensionLevel = 0,
  ascensionThreshold = MONSTER_MOVE_ASCENSION_LEVEL,
): CodexPower {
  const description = bakePowerAmountDescription(
    power.descriptionRaw,
    power.vars,
    amount,
    ascensionLevel,
    ascensionThreshold,
  );
  if (!description) return power;

  const amountValue = getEffectiveDamageValue(amount ?? null, ascensionLevel, ascensionThreshold);
  if (amountValue == null) return power;

  return {
    ...power,
    vars: {
      ...power.vars,
      Amount: amountValue,
    },
    description,
  };
}
