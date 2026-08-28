import type { DecisionsDecisionsPresetDef } from "@/lib/decisions-decisions";

export type DecisionsPresetLabelCopy = {
  presetNamedCards: string;
  presetAllRelics: string;
  presetAllPotions: string;
  presetAncientRelics: string;
  presetNamedAncientRelics: string;
  presetAct1Elites: string;
};

export type DecisionsPresetMonsterTypeLabels = {
  Boss: { label: string };
  Elite: { label: string };
};

export function decisionsPresetLabel(
  preset: DecisionsDecisionsPresetDef,
  presetLabels: Record<string, string>,
  copy: DecisionsPresetLabelCopy,
  ancientNames: Map<string, string>,
  monsterTypeLabels: DecisionsPresetMonsterTypeLabels,
): string {
  if (preset.kind === "cards") {
    const name = presetLabels[preset.key] ?? preset.key;
    if (preset.color === "colorless") return name;
    return copy.presetNamedCards.replace("{name}", name);
  }
  if (preset.kind === "relics") return copy.presetAllRelics;
  if (preset.kind === "ancient-relics") return copy.presetAncientRelics;
  if (preset.kind === "ancient-relics-named") {
    const name = ancientNames.get(preset.ancientId) ?? preset.ancientId;
    return copy.presetNamedAncientRelics.replace("{name}", name);
  }
  if (preset.kind === "monsters") {
    if (preset.key === "monsters-elite-act1") return copy.presetAct1Elites;
    if (preset.monsterType === "Boss") return monsterTypeLabels.Boss.label;
    return monsterTypeLabels.Elite.label;
  }
  if (preset.kind === "potions") return copy.presetAllPotions;
  return presetLabels[preset.key] ?? preset.key;
}
