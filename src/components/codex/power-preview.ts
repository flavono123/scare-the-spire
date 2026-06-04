"use client";

import { bakeDescription } from "@/lib/codex-bake";
import type { CodexPower, DamageValue } from "@/lib/codex-types";
import { getEffectiveDamageValue, MONSTER_MOVE_ASCENSION_LEVEL } from "./monster-ascension";

const CONTEXTLESS_AMOUNT_POWER_IDS = new Set(["VITAL_SPARK"]);
const AMOUNT_TEMPLATE_RE = /\{Amount(?::|})/;

export function getPowerCompendiumDescription(power: CodexPower): string {
  if (!CONTEXTLESS_AMOUNT_POWER_IDS.has(power.id) || !AMOUNT_TEMPLATE_RE.test(power.descriptionRaw ?? "")) {
    return power.description;
  }
  return bakeDescription(power.descriptionRaw, {
    ...power.vars,
    Amount: "X",
  });
}

export function bakePowerAmountDescription(
  descriptionRaw: string | null | undefined,
  vars: Record<string, number | string> | null | undefined,
  amount: DamageValue | null | undefined,
  ascensionLevel = 0,
  ascensionThreshold = MONSTER_MOVE_ASCENSION_LEVEL,
): string | null {
  if (!AMOUNT_TEMPLATE_RE.test(descriptionRaw ?? "")) return null;
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
