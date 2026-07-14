import type {
  CodexEncounter,
  EncounterComposition,
  EncounterMonsterRef,
} from "./codex-types";

export interface EncounterFormation {
  id: string;
  compositionId: string;
  monsters: EncounterFormationMonsterRef[];
  probability: number;
}

export interface EncounterFormationMonsterRef extends EncounterMonsterRef {
  slotName: string | null;
}

function expandCompositionSlots(
  composition: EncounterComposition,
): Array<{ choiceIds: number[]; monsters: EncounterFormationMonsterRef[] }> {
  let formations: Array<{ choiceIds: number[]; monsters: EncounterFormationMonsterRef[] }> = [
    { choiceIds: [], monsters: [] },
  ];

  for (const [slotIndex, slot] of composition.slots.entries()) {
    if (slot.length === 0) return [];
    formations = formations.flatMap((formation) =>
      slot.map((monster, choiceIndex) => ({
        choiceIds: [...formation.choiceIds, choiceIndex],
        monsters: [
          ...formation.monsters,
          { ...monster, slotName: composition.slotNames[slotIndex] ?? null },
        ],
      })),
    );
  }

  return formations;
}

export function expandEncounterFormations(encounter: CodexEncounter): EncounterFormation[] {
  const compositions = encounter.compositions?.filter(
    (composition) => composition.weight > 0 && composition.slots.length > 0,
  );
  if (!compositions?.length) {
    return encounter.monsters.length > 0
      ? [{
          id: `${encounter.id}:default`,
          compositionId: "default",
          monsters: encounter.monsters.map((monster) => ({ ...monster, slotName: null })),
          probability: 1,
        }]
      : [];
  }

  const totalWeight = compositions.reduce((sum, composition) => sum + composition.weight, 0);
  return compositions.flatMap((composition) => {
    const formations = expandCompositionSlots(composition);
    const probability = composition.weight / totalWeight / formations.length;
    return formations.map((formation) => ({
      id: `${encounter.id}:${composition.id}:${formation.choiceIds.join("-")}`,
      compositionId: composition.id,
      monsters: formation.monsters,
      probability,
    }));
  });
}

export function getEncounterMonsterIds(
  encounter: Pick<CodexEncounter, "monsters" | "compositions">,
): string[] {
  const ids = new Set<string>();
  if (encounter.compositions?.length) {
    for (const composition of encounter.compositions) {
      for (const slot of composition.slots) {
        for (const monster of slot) ids.add(monster.id);
      }
    }
  } else {
    for (const monster of encounter.monsters) ids.add(monster.id);
  }
  return Array.from(ids);
}

export function formatEncounterProbability(probability: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(probability);
}

export function formatEncounterLossText(
  lossText: string,
  characterName: string,
  encounterName: string,
): string {
  return lossText
    .replaceAll("{character}", characterName)
    .replaceAll("{encounter}", encounterName);
}
