import ancientScenes from "../../data/sts2/ancient-scene-assets.json";
import encounterScenes from "../../data/sts2/encounter-scene-assets.json";
import { stripReplayId } from "@/lib/history-last-scene";

type EncounterSceneRow = {
  id: string;
  backgroundUrl: string;
  monsterSlots?: { x: number; y: number }[];
};
type AncientSceneRow = {
  id: string;
  baseArt?: { path?: string };
  fallback?: { path?: string };
};

const ENCOUNTER_BY_ID = new Map(
  (encounterScenes as EncounterSceneRow[]).map((row) => [row.id.toUpperCase(), row]),
);

const ANCIENT_BY_ID = new Map(
  (ancientScenes as AncientSceneRow[]).map((row) => [row.id.toUpperCase(), row]),
);

export const ACT_ENCOUNTER_BACKGROUND: Record<string, string> = {
  OVERGROWTH: "/images/sts2/encounter-scenes/overgrowth-a.webp",
  HIVE: "/images/sts2/encounter-scenes/hive-a.webp",
  GLORY: "/images/sts2/encounter-scenes/glory-a.webp",
  UNDERDOCKS: "/images/sts2/encounter-scenes/underdocks-a.webp",
};

const MONSTER_STILL_OVERRIDES: Record<string, string> = {
  FAKE_MERCHANT_MONSTER: "/images/sts2/npcs/fake_merchant.webp",
  DECIMILLIPEDE_SEGMENT: "/images/sts2/monsters-render/decimillipede.webp",
  KAISER_CRAB: "/images/sts2/monsters-render/kaiser_crab.webp",
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
  const custom = encounterId ? ENCOUNTER_BY_ID.get(encounterId)?.backgroundUrl : undefined;
  return custom || actEncounterBackgroundUrl(actId);
}

export function lastSceneMonsterSlots(
  modelId: string | null | undefined,
): { leftPct: number; topPct: number }[] {
  const encounterId = stripReplayId(modelId ?? "").toUpperCase();
  const slots = encounterId ? ENCOUNTER_BY_ID.get(encounterId)?.monsterSlots : undefined;
  if (!slots?.length) return [];
  return slots.map((slot) => ({ leftPct: slot.x * 100, topPct: slot.y * 100 }));
}

export function monsterStillUrl(id: string): string {
  const key = stripReplayId(id).toUpperCase();
  return MONSTER_STILL_OVERRIDES[key] ?? `/images/sts2/monsters-render/${key.toLowerCase()}.webp`;
}

export function eventArtUrl(modelId: string | null | undefined): string | null {
  const slug = stripReplayId(modelId ?? "").toLowerCase();
  if (!slug || slug === "event" || slug === "unknown") return null;
  return `/images/sts2/events/${slug}.webp`;
}

export function ancientBackgroundUrl(modelId: string | null | undefined): string | null {
  const id = stripReplayId(modelId ?? "").toUpperCase();
  if (!id) return null;
  const row = ANCIENT_BY_ID.get(id);
  if (!row) return null;
  // Fallback stills already composite the Ancient body; empty baseArt rooms
  // look like a dim overlay on the map.
  return row.fallback?.path || row.baseArt?.path || null;
}

/**
 * `animations/backgrounds/treasure_room/chest_room_act_{1,2,3}` — one Spine
 * actor per act. There is no Underdocks chest room in the PCK.
 */
const TREASURE_ROOM_ACT: Record<string, 1 | 2 | 3> = {
  OVERGROWTH: 1,
  HIVE: 2,
  GLORY: 3,
};

export function treasureRoomSpineAct(actId: string | null | undefined): 1 | 2 | 3 {
  const key = stripReplayId(actId ?? "").toUpperCase();
  return TREASURE_ROOM_ACT[key] ?? 1;
}

export function lastSceneBackgroundUrl(opts: {
  kind: string;
  modelId: string | null | undefined;
  actId: string | null | undefined;
}): string {
  if (opts.kind === "treasure") {
    // Treasure rooms are a black ColorRect + chest_room Spine, not the
    // act combat cave. The stage loads the Spine actor itself.
    return "";
  }
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
