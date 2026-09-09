import type { LastSceneKind } from "@/lib/history-last-scene";
import type { ReplayChoice, ReplayHistoryEntry } from "@/lib/sts2-run-replay";

/** Intra-node last-scene beat, wall-clock. Playback rate does not shorten this. */
export const LAST_SCENE_STEP_MS = 1200;

export type CombatLootSpec =
  | { kind: "gold"; amount: number; stolen: boolean }
  | { kind: "potion"; choice: ReplayChoice }
  | { kind: "relic"; choice: ReplayChoice }
  | { kind: "card-removal" };

export type LastScenePhase =
  | { kind: "alive" }
  | { kind: "dying" }
  | { kind: "loot"; revealedCount: number; total: number }
  | { kind: "cards" }
  | { kind: "choice" }
  | { kind: "receipt" }
  | { kind: "shop" }
  | { kind: "chest" }
  | { kind: "rest" }
  | { kind: "death" };

export function hasCardRewardScreen(entry: ReplayHistoryEntry): boolean {
  return (entry.card_choices ?? []).some((choice) => choice.id);
}

export function combatLootSpecs(entry: ReplayHistoryEntry): CombatLootSpec[] {
  const items: CombatLootSpec[] = [];
  const stolen = entry.gold_stolen ?? 0;
  const gold = entry.gold_gained ?? 0;
  if (stolen > 0) items.push({ kind: "gold", amount: stolen, stolen: true });
  else if (gold > 0) items.push({ kind: "gold", amount: gold, stolen: false });

  for (const choice of entry.potion_choices ?? []) {
    if (choice.id) items.push({ kind: "potion", choice });
  }
  for (const choice of entry.relic_choices ?? []) {
    if (choice.id) items.push({ kind: "relic", choice });
  }
  if ((entry.cards_removed ?? []).some((card) => card.id)) {
    items.push({ kind: "card-removal" });
  }
  return items;
}

export function lastSceneStepCount(
  kind: LastSceneKind,
  entry: ReplayHistoryEntry,
): number {
  switch (kind) {
    case "combat": {
      const loot = combatLootSpecs(entry);
      return 2 + loot.length + (hasCardRewardScreen(entry) ? 1 : 0);
    }
    case "treasure": {
      const loot = combatLootSpecs(entry);
      return 1 + loot.length + (hasCardRewardScreen(entry) ? 1 : 0);
    }
    case "event":
    case "ancient":
    case "rest":
      return 2;
    case "shop":
      return 3;
    case "death":
      return 3;
    default:
      return 1;
  }
}

export function lastSceneDurationMs(
  kind: LastSceneKind,
  entry: ReplayHistoryEntry,
): number {
  return lastSceneStepCount(kind, entry) * LAST_SCENE_STEP_MS;
}

export function lastSceneStepIndex(sceneLocalMs: number): number {
  return Math.max(0, Math.floor(sceneLocalMs / LAST_SCENE_STEP_MS));
}

export function lastScenePhase(
  kind: LastSceneKind,
  entry: ReplayHistoryEntry,
  sceneLocalMs: number,
): LastScenePhase {
  const step = lastSceneStepIndex(sceneLocalMs);
  if (kind === "combat") {
    if (step <= 0) return { kind: "alive" };
    if (step === 1) return { kind: "dying" };
    const loot = combatLootSpecs(entry);
    const lootStep = step - 2;
    if (loot.length > 0 && lootStep < loot.length) {
      return { kind: "loot", revealedCount: lootStep + 1, total: loot.length };
    }
    if (hasCardRewardScreen(entry)) return { kind: "cards" };
    if (loot.length > 0) {
      return { kind: "loot", revealedCount: loot.length, total: loot.length };
    }
    return { kind: "dying" };
  }
  if (kind === "treasure") {
    if (step <= 0) return { kind: "chest" };
    const loot = combatLootSpecs(entry);
    const lootStep = step - 1;
    if (loot.length > 0 && lootStep < loot.length) {
      return { kind: "loot", revealedCount: lootStep + 1, total: loot.length };
    }
    if (hasCardRewardScreen(entry)) return { kind: "cards" };
    if (loot.length > 0) {
      return { kind: "loot", revealedCount: loot.length, total: loot.length };
    }
    return { kind: "chest" };
  }
  if (kind === "event" || kind === "ancient" || kind === "rest") {
    return step <= 0 ? { kind: "choice" } : { kind: "receipt" };
  }
  if (kind === "shop") return { kind: "shop" };
  if (kind === "death") return { kind: "death" };
  return { kind: "choice" };
}

/** Topbar relics/potions should appear once the player would have taken loot. */
export function lastScenePicksRevealed(
  kind: LastSceneKind,
  entry: ReplayHistoryEntry,
  sceneLocalMs: number,
): boolean {
  const phase = lastScenePhase(kind, entry, sceneLocalMs);
  return (
    phase.kind === "loot" ||
    phase.kind === "cards" ||
    phase.kind === "receipt" ||
    phase.kind === "shop"
  );
}
