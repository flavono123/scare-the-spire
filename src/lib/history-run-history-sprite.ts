import type { ReplayHistoryEntry } from "@/lib/sts2-run-replay";

const ANCIENT_KEYS = new Set([
  "NEOW",
  "TEZCATARA",
  "VAKUU",
  "OROBAS",
  "PAEL",
  "DARV",
  "NONUPEIPE",
  "TANX",
]);

function ancientSpriteSrc(modelId: string | null): string | null {
  if (!modelId) return null;
  const match = modelId.match(/^EVENT\.(.+)$/);
  if (!match) return null;
  if (!ANCIENT_KEYS.has(match[1])) return null;
  return `/images/sts2/run-history/${match[1].toLowerCase()}.png`;
}

function bossKeyFromEntry(entry: ReplayHistoryEntry): string | null {
  const id = entry.rooms?.[0]?.model_id;
  if (!id) return null;
  const match = id.match(/^ENCOUNTER\.(.+_BOSS)$/);
  return match ? match[1] : null;
}

/** Small run-history list icon for a visited map point. */
export function historyRunHistorySpriteSrc(entry: ReplayHistoryEntry): string {
  const modelId = entry.rooms?.[0]?.model_id ?? null;
  if (entry.map_point_type === "ancient") {
    return ancientSpriteSrc(modelId) ?? "/images/sts2/run-history/ancient.png";
  }
  if (modelId === "EVENT.NEOW") return "/images/sts2/run-history/neow.png";
  if (modelId === "ROOM.ANCIENT") return "/images/sts2/run-history/ancient.png";
  if (entry.map_point_type === "boss") {
    const bossKey = bossKeyFromEntry(entry);
    if (bossKey) return `/images/sts2/bosses/${bossKey.toLowerCase()}.webp`;
    return "/images/sts2/run-history/monster.png";
  }
  return historyRunFloorTypeSpriteSrc(entry.map_point_type);
}

/** Fallback icon when only the map point type is stored on a comment. */
export function historyRunFloorTypeSpriteSrc(mapPointType: string): string {
  switch (mapPointType) {
    case "ancient":
      return "/images/sts2/run-history/ancient.png";
    case "monster":
      return "/images/sts2/run-history/monster.png";
    case "elite":
      return "/images/sts2/run-history/elite.png";
    case "rest_site":
      return "/images/sts2/run-history/rest_site.png";
    case "treasure":
      return "/images/sts2/run-history/treasure.png";
    case "shop":
      return "/images/sts2/run-history/shop.png";
    case "unknown":
      return "/images/sts2/run-history/event.png";
    case "boss":
      return "/images/sts2/run-history/monster.png";
    default:
      return "/images/sts2/run-history/monster.png";
  }
}
