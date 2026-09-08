import type {
  CodexAncient,
  CodexCharacter,
  CodexEncounter,
  CodexEvent,
} from "@/lib/codex-types";
import { characterSlug } from "@/lib/history-party";
import { stripReplayId } from "@/lib/history-last-scene";

export type HistoryChoiceLoc = {
  events: Record<string, string>;
  ancients: Record<string, string>;
  relics: Record<string, string>;
};

export type HistoryLastSceneCatalog = {
  encounters: CodexEncounter[];
  characters: CodexCharacter[];
  ancients: CodexAncient[];
  events: CodexEvent[];
  choiceLoc: HistoryChoiceLoc;
};

let cached: HistoryLastSceneCatalog | null = null;
let inflight: Promise<HistoryLastSceneCatalog> | null = null;

export function loadHistoryLastSceneCatalog(): Promise<HistoryLastSceneCatalog> {
  if (cached) return Promise.resolve(cached);
  if (inflight) return inflight;
  inflight = import("@/generated/history-last-scene-catalog.json")
    .then((mod) => {
      cached = mod.default as unknown as HistoryLastSceneCatalog;
      inflight = null;
      return cached;
    })
    .catch((error: unknown) => {
      inflight = null;
      throw error;
    });
  return inflight;
}

export function lookupHistoryEncounter(
  encounters: CodexEncounter[],
  modelId: string | null | undefined,
): CodexEncounter | undefined {
  const id = stripReplayId(modelId ?? "").toUpperCase();
  if (!id) return undefined;
  return encounters.find((encounter) => encounter.id.toUpperCase() === id);
}

export function lookupHistoryCharacter(
  characters: CodexCharacter[],
  character: string | undefined,
): CodexCharacter | undefined {
  const id = characterSlug(character).toUpperCase();
  return characters.find((row) => row.id.toUpperCase() === id);
}

export function lookupHistoryAncient(
  ancients: CodexAncient[],
  modelId: string | null | undefined,
): CodexAncient | undefined {
  const id = stripReplayId(modelId ?? "").toUpperCase();
  if (!id) return undefined;
  return ancients.find((ancient) => ancient.id.toUpperCase() === id);
}

export function lookupHistoryEvent(
  events: CodexEvent[],
  modelId: string | null | undefined,
): CodexEvent | undefined {
  const id = stripReplayId(modelId ?? "").toUpperCase();
  if (!id || id === "NEOW") return undefined;
  return events.find((event) => event.id.toUpperCase() === id);
}
