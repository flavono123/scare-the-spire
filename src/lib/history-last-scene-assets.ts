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

export function encounterLookupId(modelId: string | null | undefined): string {
  const encounterId = stripReplayId(modelId ?? "").toUpperCase();
  if (!encounterId) return "";
  if (ENCOUNTER_BY_ID.has(encounterId)) return encounterId;
  const bossId = `${encounterId}_BOSS`;
  if (ENCOUNTER_BY_ID.has(bossId)) return bossId;
  return encounterId;
}

export function encounterBackgroundUrl(
  modelId: string | null | undefined,
  actId: string | null | undefined,
): string {
  const encounterId = encounterLookupId(modelId);
  const custom = encounterId ? ENCOUNTER_BY_ID.get(encounterId)?.backgroundUrl : undefined;
  return custom || actEncounterBackgroundUrl(actId);
}

export function lastSceneMonsterSlots(
  modelId: string | null | undefined,
): { leftPct: number; topPct: number }[] {
  const encounterId = encounterLookupId(modelId);
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

const REST_SITE_BACKGROUND: Record<string, string> = {
  OVERGROWTH: "/images/sts2/rooms/rest-sites/overgrowth_rest_site_bg.webp",
  HIVE: "/images/sts2/rooms/rest-sites/hive_rest_site_00.webp",
  GLORY: "/images/sts2/rooms/rest-sites/glory_rest_site_00.webp",
  UNDERDOCKS: "/images/sts2/rooms/rest-sites/underdocks_rest_site_bg.webp",
};

export function restSiteBackgroundUrl(actId: string | null | undefined): string {
  const key = stripReplayId(actId ?? "").toUpperCase();
  return REST_SITE_BACKGROUND[key] ?? REST_SITE_BACKGROUND.OVERGROWTH;
}

export function restSiteFireUrl(actId: string | null | undefined): string {
  const key = stripReplayId(actId ?? "").toUpperCase();
  const fires: Record<string, string> = {
    OVERGROWTH: "/images/sts2/rooms/rest-sites/overgrowth_rest_site_fire.webp",
    HIVE: "/images/sts2/rooms/rest-sites/hive_rest_site_fire.webp",
    GLORY: "/images/sts2/rooms/rest-sites/glory_rest_site_fire.webp",
    UNDERDOCKS: "/images/sts2/rooms/rest-sites/underdocks_rest_site_fire.webp",
  };
  return fires[key] ?? fires.OVERGROWTH;
}

export function restSiteFireClassName(actId: string | null | undefined): string {
  const key = stripReplayId(actId ?? "").toUpperCase();
  if (key === "HIVE") {
    return "absolute left-[41.8%] top-[59.9%] h-[15.7%] w-[11.4%] object-contain";
  }
  if (key === "GLORY") {
    return "absolute left-[44%] top-[62%] h-[14%] w-[10%] object-contain";
  }
  if (key === "UNDERDOCKS") {
    return "absolute left-[45%] top-[66%] h-[11%] w-[8%] object-contain";
  }
  return "absolute bottom-[18%] left-1/2 h-[22%] w-[22%] -translate-x-1/2 object-contain";
}

export type RestSiteCharacterSpine = {
  atlasUrl: string;
  skelUrl: string;
  ostyAtlasUrl?: string;
  ostySkelUrl?: string;
};

export function restSiteCharacterSpine(character: string | undefined): RestSiteCharacterSpine {
  const slug = stripReplayId(character ?? "ironclad").toLowerCase() || "ironclad";
  const folder = `/spine/sts2/rest-site/${slug}`;
  const file = `restsite_${slug}`;
  const spine: RestSiteCharacterSpine = {
    atlasUrl: `${folder}/${file}.atlas`,
    skelUrl: `${folder}/${file}.skel`,
  };
  if (slug === "necrobinder") {
    spine.ostyAtlasUrl = `${folder}/restsite_osty.atlas`;
    spine.ostySkelUrl = `${folder}/restsite_osty.skel`;
  }
  return spine;
}

export function restSiteCharacterAnimation(actId: string | null | undefined): string {
  const key = stripReplayId(actId ?? "").toUpperCase();
  if (key === "HIVE") return "hive_loop";
  if (key === "GLORY") return "glory_loop";
  return "overgrowth_loop";
}

export function lastSceneBackgroundUrl(opts: {
  kind: string;
  modelId: string | null | undefined;
  actId: string | null | undefined;
}): string {
  if (opts.kind === "rest") {
    return restSiteBackgroundUrl(opts.actId);
  }
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
