import type {
  CodexEncounter,
  EncounterComposition,
  EncounterMonsterRef,
} from "./codex-types";

export interface EncounterFormation {
  id: string;
  compositionId: string;
  monsters: EncounterMonsterRef[];
  probability: number;
}

function expandCompositionSlots(
  composition: EncounterComposition,
): Array<{ choiceIds: number[]; monsters: EncounterMonsterRef[] }> {
  let formations: Array<{ choiceIds: number[]; monsters: EncounterMonsterRef[] }> = [
    { choiceIds: [], monsters: [] },
  ];

  for (const slot of composition.slots) {
    if (slot.length === 0) return [];
    formations = formations.flatMap((formation) =>
      slot.map((monster, choiceIndex) => ({
        choiceIds: [...formation.choiceIds, choiceIndex],
        monsters: [...formation.monsters, monster],
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
          monsters: encounter.monsters,
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

export function getEncounterMonsterIds(encounter: CodexEncounter): string[] {
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
