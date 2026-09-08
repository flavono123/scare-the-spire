import ancientScenes from "../../data/sts2/ancient-scene-assets.json";
import encounterScenes from "../../data/sts2/encounter-scene-assets.json";
import { stripReplayId } from "@/lib/history-last-scene";

type EncounterSceneRow = { id: string; backgroundUrl: string };
type AncientSceneRow = {
  id: string;
  baseArt?: { path?: string };
  fallback?: { path?: string };
};

const ENCOUNTER_BG_BY_ID = new Map(
  (encounterScenes as EncounterSceneRow[]).map((row) => [
    row.id.toUpperCase(),
    row.backgroundUrl,
  ]),
);

const ANCIENT_BG_BY_ID = new Map(
  (ancientScenes as AncientSceneRow[]).map((row) => [
    row.id.toUpperCase(),
    row.baseArt?.path ?? row.fallback?.path ?? "",
  ]),
);

export const ACT_ENCOUNTER_BACKGROUND: Record<string, string> = {
  OVERGROWTH: "/images/sts2/encounter-scenes/overgrowth-a.webp",
  HIVE: "/images/sts2/encounter-scenes/hive-a.webp",
  GLORY: "/images/sts2/encounter-scenes/glory-a.webp",
  UNDERDOCKS: "/images/sts2/encounter-scenes/underdocks-a.webp",
};

export function actEncounterBackgroundUrl(actId: string | null | undefined): string {
  const key = stripReplayId(actId ?? "").toUpperCase();
  return ACT_ENCOUNTER_BACKGROUND[key] ?? ACT_ENCOUNTER_BACKGROUND.OVERGROWTH;
}

export function encounterBackgroundUrl(
  modelId: string | null | undefined,
  actId: string | null | undefined,
): string {
  const encounterId = stripReplayId(modelId ?? "").toUpperCase();
  const custom = encounterId ? ENCOUNTER_BG_BY_ID.get(encounterId) : undefined;
  return custom || actEncounterBackgroundUrl(actId);
}

export function eventArtUrl(modelId: string | null | undefined): string | null {
  const slug = stripReplayId(modelId ?? "").toLowerCase();
  if (!slug || slug === "event" || slug === "unknown") return null;
  return `/images/sts2/events/${slug}.webp`;
}

export function ancientBackgroundUrl(modelId: string | null | undefined): string | null {
  const id = stripReplayId(modelId ?? "").toUpperCase();
  if (!id) return null;
  const path = ANCIENT_BG_BY_ID.get(id);
  return path || null;
}

export function lastSceneBackgroundUrl(opts: {
  kind: string;
  modelId: string | null | undefined;
  actId: string | null | undefined;
}): string {
  if (opts.kind === "event") {
    return eventArtUrl(opts.modelId) ?? actEncounterBackgroundUrl(opts.actId);
  }
  if (opts.kind === "ancient") {
    return ancientBackgroundUrl(opts.modelId) ?? actEncounterBackgroundUrl(opts.actId);
  }
  if (opts.kind === "combat" || opts.kind === "death") {
    return encounterBackgroundUrl(opts.modelId, opts.actId);
  }
  return actEncounterBackgroundUrl(opts.actId);
}
