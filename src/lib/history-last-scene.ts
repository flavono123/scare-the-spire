import type {
  ReplayActAnalysis,
  ReplayChoice,
  ReplayHistoryEntry,
  ReplayRun,
} from "@/lib/sts2-run-replay";

export type LastSceneKind =
  | "combat"
  | "shop"
  | "event"
  | "treasure"
  | "rest"
  | "ancient"
  | "death"
  | "stack";

export type HighlightKind =
  | "starter-upgrade"
  | "nonstarter-upgrade"
  | "shop-leftover"
  | "ironic-death"
  | "unknown-combat-streak"
  | "skip-rewards"
  | "steal";

const COMBAT_ROOM_TYPES = new Set(["monster", "elite", "boss"]);
const STARTER_CARD_RE = /^(STRIKE_|DEFEND_)/i;
const ANCIENT_MODEL_IDS = new Set([
  "NEOW",
  "DARV",
  "NONUPEIPE",
  "OROBAS",
  "PAEL",
  "TANX",
  "TEZCATARA",
  "VAKUU",
  "THE_ARCHITECT",
]);

export function stripReplayId(id: string): string {
  return id.includes(".") ? (id.split(".").pop() ?? id) : id;
}

export function isCombatRoomType(roomType: string | undefined): boolean {
  return COMBAT_ROOM_TYPES.has(roomType ?? "");
}

export function roomMonsterIds(entry: ReplayHistoryEntry): string[] {
  return (entry.rooms ?? []).flatMap((room) => room.monster_ids ?? []);
}

export function resolvedRoomType(entry: ReplayHistoryEntry): string {
  return entry.rooms?.[0]?.room_type ?? entry.map_point_type;
}

export function isCombatHistoryEntry(entry: ReplayHistoryEntry): boolean {
  if (isAncientHistoryEntry(entry)) return false;
  if (isCombatRoomType(entry.map_point_type)) return true;
  if (isCombatRoomType(resolvedRoomType(entry))) return true;
  return roomMonsterIds(entry).length > 0;
}

export function isAncientHistoryEntry(entry: ReplayHistoryEntry): boolean {
  if (entry.map_point_type === "ancient") return true;
  if (resolvedRoomType(entry) === "ancient") return true;
  const model = stripReplayId(entry.rooms?.[0]?.model_id ?? "").toUpperCase();
  return ANCIENT_MODEL_IDS.has(model);
}

export function isTerminalDeathEntry(
  run: ReplayRun | undefined,
  acts: ReplayActAnalysis[],
  actIndex: number,
  entryIndex: number,
): boolean {
  if (!run || run.win) return false;
  const lastAct = acts.length - 1;
  if (actIndex !== lastAct) return false;
  const lastEntry = (acts[lastAct]?.history.length ?? 0) - 1;
  if (entryIndex !== lastEntry) return false;
  const entry = acts[lastAct]?.history[entryIndex];
  if (run.was_abandoned) return true;
  if ((entry?.current_hp ?? 1) === 0) return true;
  return Boolean(run.killed_by_encounter || run.killed_by_event);
}

export function lastSceneKind(
  entry: ReplayHistoryEntry,
  opts?: { isTerminalDeath?: boolean },
): LastSceneKind {
  if (opts?.isTerminalDeath) return "death";
  const mapType = entry.map_point_type;
  const roomType = resolvedRoomType(entry);
  if (mapType === "rest_site" || roomType === "rest_site") return "rest";
  if (isAncientHistoryEntry(entry)) return "ancient";
  if (mapType === "treasure" || roomType === "treasure") return "treasure";
  if (mapType === "shop" || roomType === "shop") return "shop";
  if (isCombatHistoryEntry(entry)) return "combat";
  const hasEventBits =
    (entry.event_choices ?? []).length > 0 ||
    roomType === "event" ||
    Boolean(entry.rooms?.[0]?.model_id);
  if (mapType === "unknown" || roomType === "event" || hasEventBits) {
    if (hasEventBits) return "event";
  }
  return "stack";
}

export function usesDedicatedLastScene(kind: LastSceneKind): boolean {
  return kind !== "stack";
}

function choiceIdMatches(choice: ReplayChoice, needle: string): boolean {
  return stripReplayId(choice.id).toUpperCase() === needle;
}

function upgradedCardIsStarter(id: string): boolean {
  return STARTER_CARD_RE.test(stripReplayId(id));
}

function isRandomUpgradeFloor(entry: ReplayHistoryEntry): boolean {
  const upgrades = entry.upgraded_cards ?? [];
  if (upgrades.length === 0) return false;
  const rest = (entry.rest_site_choices ?? []).map((c) => c.toUpperCase());
  if (rest.some((c) => c.includes("SMITH"))) return false;
  const relics = entry.relic_choices ?? [];
  const warPaint = relics.some(
    (choice) => choiceIdMatches(choice, "WAR_PAINT") && choice.picked,
  );
  if (warPaint) return true;
  const kind = lastSceneKind(entry);
  return kind === "event" || kind === "combat";
}

function leftoverGoldShopHighlight(entry: ReplayHistoryEntry): boolean {
  const relics = entry.relic_choices ?? [];
  const tent = relics.find((choice) => choiceIdMatches(choice, "MINIATURE_TENT"));
  if (tent) return true;
  if (lastSceneKind(entry) !== "shop") return false;
  const unbought = relics.filter((choice) => !choice.picked);
  const gold = entry.current_gold ?? 0;
  return unbought.length > 0 && gold <= 20;
}

export function highlightKindsForEntry(
  entry: ReplayHistoryEntry,
  ctx: {
    actEntries: ReplayHistoryEntry[];
    entryIndex: number;
    isTerminalDeath: boolean;
    previous?: ReplayHistoryEntry;
  },
): HighlightKind[] {
  const kinds: HighlightKind[] = [];
  const upgrades = entry.upgraded_cards ?? [];
  if (isRandomUpgradeFloor(entry) && upgrades.length > 0) {
    if (upgrades.every(upgradedCardIsStarter)) kinds.push("starter-upgrade");
    else if (upgrades.some((id) => !upgradedCardIsStarter(id))) {
      kinds.push("nonstarter-upgrade");
    }
  }
  if (leftoverGoldShopHighlight(entry)) kinds.push("shop-leftover");

  if (ctx.isTerminalDeath) {
    const prevHp = ctx.previous?.current_hp;
    const prevMax = ctx.previous?.max_hp;
    const restOpen = (ctx.previous?.rest_site_choices ?? []).length >= 2;
    const healthy =
      (typeof prevHp === "number" && prevHp >= 40) ||
      (typeof prevHp === "number" &&
        typeof prevMax === "number" &&
        prevMax > 0 &&
        prevHp / prevMax >= 0.5);
    if (healthy || restOpen) kinds.push("ironic-death");
  }

  if (isCombatHistoryEntry(entry)) {
    const choices = entry.card_choices ?? [];
    if (
      choices.length > 0 &&
      !choices.some((choice) => choice.picked) &&
      (entry.map_point_type === "elite" ||
        entry.map_point_type === "boss" ||
        resolvedRoomType(entry) === "elite" ||
        resolvedRoomType(entry) === "boss")
    ) {
      kinds.push("skip-rewards");
    }
  }

  if ((entry.gold_stolen ?? 0) > 0 || (entry.stolen_loot ?? 0) > 0) {
    kinds.push("steal");
  }

  if (entry.map_point_type === "unknown" && isCombatHistoryEntry(entry)) {
    let streak = 1;
    for (let i = ctx.entryIndex - 1; i >= 0; i--) {
      const prev = ctx.actEntries[i];
      if (prev.map_point_type === "unknown" && isCombatHistoryEntry(prev)) {
        streak += 1;
      } else {
        break;
      }
    }
    for (let i = ctx.entryIndex + 1; i < ctx.actEntries.length; i++) {
      const next = ctx.actEntries[i];
      if (next.map_point_type === "unknown" && isCombatHistoryEntry(next)) {
        streak += 1;
      } else {
        break;
      }
    }
    if (streak >= 2) kinds.push("unknown-combat-streak");
  }

  return kinds;
}

export function highlightKindsForAct(
  entries: ReplayHistoryEntry[],
  opts: { isLastAct: boolean; run?: ReplayRun; actIndex: number; acts: ReplayActAnalysis[] },
): HighlightKind[][] {
  return entries.map((entry, entryIndex) =>
    highlightKindsForEntry(entry, {
      actEntries: entries,
      entryIndex,
      isTerminalDeath: isTerminalDeathEntry(
        opts.run,
        opts.acts,
        opts.actIndex,
        entryIndex,
      ),
      previous: entryIndex > 0 ? entries[entryIndex - 1] : undefined,
    }),
  );
}
