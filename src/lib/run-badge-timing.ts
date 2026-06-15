import type {
  ReplayBadge,
  ReplayBadgeRarity,
  ReplayHistoryEntry,
  ReplayRun,
} from "@/lib/sts2-run-replay";

const ELITE_THRESHOLDS = { bronze: 3, silver: 6, gold: 9 } as const;
const PERFECT_THRESHOLDS = { bronze: 1, silver: 2, gold: 3 } as const;
const MYSTERY_MACHINE_EVENTS = 15;
const KACHING_GOLD_SPENT = 1000;
const SHINY_RELICS = 25;

export function visibleRunBadgesAtFloor(
  run: ReplayRun,
  currentFloor: number,
  ended: boolean,
): ReplayBadge[] {
  const badges = run.players[0]?.badges ?? [];
  if (ended) return badges;

  return badges.filter((badge) => {
    const floor = badgeAvailableFloor(run, badge);
    return floor !== null && floor <= currentFloor;
  });
}

function badgeAvailableFloor(run: ReplayRun, badge: ReplayBadge): number | null {
  switch (normalizeId(badge.id)) {
    case "ELITE":
      return floorOfNthElite(run, thresholdForRarity(badge.rarity, ELITE_THRESHOLDS));
    case "PERFECT":
      return floorOfNthPerfectBoss(run, thresholdForRarity(badge.rarity, PERFECT_THRESHOLDS));
    case "MYSTERY_MACHINE":
      return floorOfNthUnknown(run, MYSTERY_MACHINE_EVENTS);
    case "KACHING":
      return floorOfCumulativeShopSpend(run, KACHING_GOLD_SPENT);
    case "ILIKESHINY":
      return floorOfNthRelic(run, SHINY_RELICS);
    case "DOUBLE_SNECKO":
      return floorOfAllRelics(run, ["SNECKO_EYE", "FAKE_SNECKO_EYE"]);
    default:
      return null;
  }
}

function thresholdForRarity(
  rarity: ReplayBadgeRarity,
  thresholds: Record<"bronze" | "silver" | "gold", number>,
): number {
  if (rarity === "gold") return thresholds.gold;
  if (rarity === "silver") return thresholds.silver;
  return thresholds.bronze;
}

function normalizeId(id: string): string {
  return id.replace(/^[A-Z]+\./, "").toUpperCase();
}

function flattenedHistory(run: ReplayRun): Array<{
  entry: ReplayHistoryEntry;
  floor: number;
  isFinalEntry: boolean;
}> {
  const totalFloors = run.map_point_history.reduce(
    (sum, history) => sum + history.length,
    0,
  );
  const result: Array<{
    entry: ReplayHistoryEntry;
    floor: number;
    isFinalEntry: boolean;
  }> = [];
  let floor = 1;
  for (const act of run.map_point_history) {
    for (const entry of act) {
      result.push({
        entry,
        floor,
        isFinalEntry: floor === totalFloors,
      });
      floor += 1;
    }
  }
  return result;
}

function entryHasRoom(entry: ReplayHistoryEntry, roomType: string): boolean {
  const normalized = roomType.toLowerCase();
  return entry.rooms.some((room) => room.room_type.toLowerCase() === normalized);
}

function floorOfNthElite(run: ReplayRun, threshold: number): number | null {
  let count = 0;
  for (const { entry, floor, isFinalEntry } of flattenedHistory(run)) {
    const isElite = entry.map_point_type === "elite" || entryHasRoom(entry, "Elite");
    if (!isElite) continue;
    if (!run.win && isFinalEntry) continue;
    count += 1;
    if (count >= threshold) return floor;
  }
  return null;
}

function floorOfNthPerfectBoss(run: ReplayRun, threshold: number): number | null {
  let count = 0;
  for (const { entry, floor, isFinalEntry } of flattenedHistory(run)) {
    const isBoss = entry.map_point_type === "boss" || entryHasRoom(entry, "Boss");
    if (!isBoss) continue;
    if (!run.win && isFinalEntry) continue;
    if ((entry.damage_taken ?? 0) > 0) continue;
    count += 1;
    if (count >= threshold) return floor;
  }
  return null;
}

function floorOfNthUnknown(run: ReplayRun, threshold: number): number | null {
  let count = 0;
  for (const { entry, floor } of flattenedHistory(run)) {
    if (entry.map_point_type !== "unknown") continue;
    count += 1;
    if (count >= threshold) return floor;
  }
  return null;
}

function floorOfCumulativeShopSpend(run: ReplayRun, threshold: number): number | null {
  let total = 0;
  for (const { entry, floor } of flattenedHistory(run)) {
    const isShop = entry.map_point_type === "shop" || entryHasRoom(entry, "Shop");
    if (!isShop) continue;
    total += entry.gold_spent ?? 0;
    if (total >= threshold) return floor;
  }
  return null;
}

function floorOfNthRelic(run: ReplayRun, threshold: number): number | null {
  const player = run.players[0];
  if (!player || player.relics.length < threshold) return null;
  const floors = player.relics
    .map((relic) => relic.floor_added_to_deck ?? 0)
    .sort((a, b) => a - b);
  return Math.max(1, floors[threshold - 1] ?? 1);
}

function floorOfAllRelics(run: ReplayRun, relicIds: string[]): number | null {
  const player = run.players[0];
  if (!player) return null;
  const floors = relicIds.map((targetId) => {
    const relic = player.relics.find((candidate) => normalizeId(candidate.id) === targetId);
    return relic ? Math.max(1, relic.floor_added_to_deck ?? 0) : null;
  });
  if (floors.some((floor) => floor === null)) return null;
  return Math.max(...(floors as number[]));
}
