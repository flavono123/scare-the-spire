import { expandEncounterFormations } from "@/lib/encounter-compositions";
import { stripReplayId } from "@/lib/history-last-scene";
import type { CodexEncounter } from "@/lib/codex-types";

function normalizedIds(ids: string[]): string[] {
  return ids.map((id) => stripReplayId(id).toUpperCase()).filter(Boolean);
}

function multisetKey(ids: string[]): string {
  return [...ids].sort().join("\0");
}

/** Pick the encounter formation whose monster ids best match the run room. */
export function matchEncounterFormationIndex(
  encounter: CodexEncounter,
  monsterIds: string[],
): number {
  const wanted = normalizedIds(monsterIds);
  const formations = expandEncounterFormations(encounter);
  if (formations.length === 0) return 0;
  const wantedKey = multisetKey(wanted);
  let best = 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < formations.length; index += 1) {
    const got = normalizedIds(formations[index].monsters.map((monster) => monster.id));
    let score = 0;
    if (multisetKey(got) === wantedKey) {
      score = 1000 + (got.join("\0") === wanted.join("\0") ? 10 : 0);
    } else {
      const wantedSet = new Set(wanted);
      const overlap = got.filter((id) => wantedSet.has(id)).length;
      score = overlap * 10 - Math.abs(got.length - wanted.length);
    }
    if (score > bestScore) {
      bestScore = score;
      best = index;
    }
  }
  return best;
}
