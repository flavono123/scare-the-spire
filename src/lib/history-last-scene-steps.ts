import type { LastSceneKind } from "@/lib/history-last-scene";
import { isLanternKeyFight, stripReplayId } from "@/lib/history-last-scene";
import type { ReplayChoice, ReplayHistoryEntry } from "@/lib/sts2-run-replay";

/** Intra-node last-scene beat, wall-clock. Playback rate does not shorten this. */
export const LAST_SCENE_STEP_MS = 1200;

/** Combat idle window so Spine can load before `die`. */
export const LAST_SCENE_ALIVE_MS = LAST_SCENE_STEP_MS;

/**
 * Combat death window. Game waits die remaining + 0.5s (`NCreature.AnimDie`)
 * before rewards; 1.2s was shorter than most `die` clips.
 */
export const LAST_SCENE_DYING_MS = 3000;

/** Relic/potion hop from `NPotion`/`NRelicInventoryHolder` 0.35s tween, after a short bob. */
export const LAST_SCENE_OBTAIN_LAND = 0.5;

export type CombatLootSpec =
  | { kind: "gold"; amount: number; stolen: boolean }
  | { kind: "potion"; choice: ReplayChoice }
  | { kind: "relic"; choice: ReplayChoice }
  | { kind: "card-removal" }
  | { kind: "cards" };

export type LastScenePhase =
  | { kind: "alive" }
  | { kind: "dying" }
  | { kind: "dead" }
  | { kind: "loot"; resolvedCount: number; total: number; beatProgress: number }
  | { kind: "cards"; beatProgress: number }
  | { kind: "choice"; beatProgress: number }
  | { kind: "receipt"; beatProgress: number }
  | { kind: "shop"; beatProgress: number; step: number }
  | { kind: "upgrade"; beatProgress: number }
  | { kind: "chest" }
  | { kind: "rest" }
  | { kind: "death" };

export function lastSceneBeatProgress(sceneLocalMs: number): number {
  if (sceneLocalMs <= 0) return 0;
  return (sceneLocalMs % LAST_SCENE_STEP_MS) / LAST_SCENE_STEP_MS;
}

export function hasCardRewardScreen(entry: ReplayHistoryEntry): boolean {
  return (entry.card_choices ?? []).some((choice) => choice.id);
}

export function lootSpecTaken(spec: CombatLootSpec, entry: ReplayHistoryEntry): boolean {
  if (spec.kind === "gold" || spec.kind === "card-removal") return true;
  if (spec.kind === "potion" || spec.kind === "relic") return Boolean(spec.choice.picked);
  return (entry.card_choices ?? []).some((choice) => choice.picked);
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
  if (hasCardRewardScreen(entry)) {
    items.push({ kind: "cards" });
  }
  return items;
}

export function combatShowsCardPicker(entry: ReplayHistoryEntry): boolean {
  const cardsRow = combatLootSpecs(entry).find((spec) => spec.kind === "cards");
  return Boolean(cardsRow && lootSpecTaken(cardsRow, entry));
}

export function lastSceneStepCount(
  kind: LastSceneKind,
  entry: ReplayHistoryEntry,
): number {
  switch (kind) {
    case "combat": {
      const loot = combatLootSpecs(entry);
      return 2 + loot.length + (combatShowsCardPicker(entry) ? 1 : 0);
    }
    case "treasure": {
      const loot = combatLootSpecs(entry);
      return 1 + loot.length + (combatShowsCardPicker(entry) ? 1 : 0);
    }
    case "event":
      if (isLanternKeyFight(entry)) {
        const loot = combatLootSpecs(entry);
        return 1 + 1 + loot.length + (combatShowsCardPicker(entry) ? 1 : 0);
      }
      return 2 + (hasCenteredUpgradeFollowUp(entry) ? 1 : 0);
    case "ancient":
      return 2 + (hasCenteredUpgradeFollowUp(entry) ? 1 : 0);
    case "rest":
      return 2;
    case "shop":
      return Math.max(3, shopObtainQueue(entry).length);
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
  if (kind === "combat") {
    const loot = combatLootSpecs(entry);
    return (
      LAST_SCENE_ALIVE_MS
      + LAST_SCENE_DYING_MS
      + loot.length * LAST_SCENE_STEP_MS
      + (combatShowsCardPicker(entry) ? LAST_SCENE_STEP_MS : 0)
    );
  }
  if (kind === "event" && isLanternKeyFight(entry)) {
    const loot = combatLootSpecs(entry);
    return (
      LAST_SCENE_STEP_MS
      + LAST_SCENE_DYING_MS
      + loot.length * LAST_SCENE_STEP_MS
      + (combatShowsCardPicker(entry) ? LAST_SCENE_STEP_MS : 0)
    );
  }
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
  const beatProgress = lastSceneBeatProgress(sceneLocalMs);
  if (kind === "combat") {
    if (sceneLocalMs < LAST_SCENE_ALIVE_MS) return { kind: "alive" };
    if (sceneLocalMs < LAST_SCENE_ALIVE_MS + LAST_SCENE_DYING_MS) return { kind: "dying" };
    const loot = combatLootSpecs(entry);
    const lootMs = sceneLocalMs - LAST_SCENE_ALIVE_MS - LAST_SCENE_DYING_MS;
    const lootStep = Math.floor(lootMs / LAST_SCENE_STEP_MS);
    const lootBeat = (lootMs % LAST_SCENE_STEP_MS) / LAST_SCENE_STEP_MS;
    if (loot.length > 0 && lootStep < loot.length) {
      return { kind: "loot", resolvedCount: lootStep, total: loot.length, beatProgress: lootBeat };
    }
    if (combatShowsCardPicker(entry)) {
      const cardMs = lootMs - loot.length * LAST_SCENE_STEP_MS;
      return {
        kind: "cards",
        beatProgress: Math.max(0, Math.min(1, (cardMs % LAST_SCENE_STEP_MS) / LAST_SCENE_STEP_MS)),
      };
    }
    if (loot.length > 0) {
      return {
        kind: "loot",
        resolvedCount: loot.length,
        total: loot.length,
        beatProgress: 1,
      };
    }
    return { kind: "dead" };
  }
  if (kind === "treasure") {
    if (step <= 0) return { kind: "chest" };
    const loot = combatLootSpecs(entry);
    const lootStep = step - 1;
    if (loot.length > 0 && lootStep < loot.length) {
      return { kind: "loot", resolvedCount: lootStep, total: loot.length, beatProgress };
    }
    if (combatShowsCardPicker(entry)) return { kind: "cards", beatProgress };
    if (loot.length > 0) {
      return {
        kind: "loot",
        resolvedCount: loot.length,
        total: loot.length,
        beatProgress: 1,
      };
    }
    return { kind: "chest" };
  }
  if (kind === "event" && isLanternKeyFight(entry)) {
    if (sceneLocalMs < LAST_SCENE_STEP_MS) {
      return { kind: "choice", beatProgress };
    }
    if (sceneLocalMs < LAST_SCENE_STEP_MS + LAST_SCENE_DYING_MS) return { kind: "dying" };
    const loot = combatLootSpecs(entry);
    const lootMs = sceneLocalMs - LAST_SCENE_STEP_MS - LAST_SCENE_DYING_MS;
    const lootStep = Math.floor(lootMs / LAST_SCENE_STEP_MS);
    const lootBeat = (lootMs % LAST_SCENE_STEP_MS) / LAST_SCENE_STEP_MS;
    if (loot.length > 0 && lootStep < loot.length) {
      return { kind: "loot", resolvedCount: lootStep, total: loot.length, beatProgress: lootBeat };
    }
    if (combatShowsCardPicker(entry)) {
      const cardMs = lootMs - loot.length * LAST_SCENE_STEP_MS;
      return {
        kind: "cards",
        beatProgress: Math.max(0, Math.min(1, (cardMs % LAST_SCENE_STEP_MS) / LAST_SCENE_STEP_MS)),
      };
    }
    if (loot.length > 0) {
      return {
        kind: "loot",
        resolvedCount: loot.length,
        total: loot.length,
        beatProgress: 1,
      };
    }
    return { kind: "dead" };
  }
  if (kind === "event" || kind === "ancient" || kind === "rest") {
    if (step <= 0) return { kind: "choice", beatProgress };
    if (kind !== "rest" && hasCenteredUpgradeFollowUp(entry) && step >= 2) {
      return { kind: "upgrade", beatProgress };
    }
    return { kind: "receipt", beatProgress };
  }
  if (kind === "shop") return { kind: "shop", beatProgress, step };
  if (kind === "death") return { kind: "death" };
  return { kind: "choice", beatProgress };
}

function hasCenteredUpgradeFollowUp(entry: ReplayHistoryEntry): boolean {
  return (entry.upgraded_cards ?? []).some((id) => Boolean(id));
}

function obtainLanded(beatProgress: number): boolean {
  return beatProgress >= LAST_SCENE_OBTAIN_LAND;
}

export type ShopObtain =
  | { kind: "relic" | "potion" | "card"; id: string }
  | { kind: "removal"; id: string };

export function shopObtainQueue(entry: ReplayHistoryEntry): ShopObtain[] {
  const out: ShopObtain[] = [];
  for (const choice of entry.relic_choices ?? []) {
    if (choice.picked && choice.id) out.push({ kind: "relic", id: choice.id });
  }
  for (const choice of entry.potion_choices ?? []) {
    if (choice.picked && choice.id) out.push({ kind: "potion", id: choice.id });
  }
  for (const choice of entry.card_choices ?? []) {
    if (choice.picked && choice.id) out.push({ kind: "card", id: choice.id });
  }
  const removed = (entry.cards_removed ?? []).find((card) => card.id);
  if (removed?.id) out.push({ kind: "removal", id: removed.id });
  return out;
}

export function shopMatItemHidden(
  entry: ReplayHistoryEntry,
  id: string,
  kind: "relic" | "potion" | "card",
  step: number,
  beatProgress: number,
): boolean {
  const queue = shopObtainQueue(entry);
  const index = queue.findIndex((item) => item.kind === kind && item.id === id);
  if (index < 0) return false;
  if (step > index) return true;
  const hideAfter = kind === "card" ? 0.04 : 0.12;
  return step === index && beatProgress > hideAfter;
}

/** `merchant_card_removal.tscn` Used clip: 00 → 01 → 02 → 04 → 05. */
export function shopRemovalFlipProgress(
  entry: ReplayHistoryEntry,
  step: number,
  beatProgress: number,
): number {
  const queue = shopObtainQueue(entry);
  const index = queue.findIndex((item) => item.kind === "removal");
  if (index < 0) {
    return (entry.cards_removed ?? []).some((card) => card.id) ? 1 : 0;
  }
  if (step < index) return 0;
  if (step > index) return 1;
  if (beatProgress < 0.45) return 0;
  return Math.max(0, Math.min(1, (beatProgress - 0.45) / 0.55));
}

export function shopRemovalPickVisible(
  entry: ReplayHistoryEntry,
  step: number,
  beatProgress: number,
): boolean {
  const queue = shopObtainQueue(entry);
  const index = queue.findIndex((item) => item.kind === "removal");
  if (index < 0) return false;
  if (step !== index) return false;
  return beatProgress < 0.72;
}

function shopObtainLanded(
  entry: ReplayHistoryEntry,
  id: string,
  kind: ShopObtain["kind"],
  sceneLocalMs: number,
): boolean {
  const queue = shopObtainQueue(entry);
  const index = queue.findIndex((item) => item.kind === kind && item.id === id);
  if (index < 0) return true;
  const steps = lastSceneStepCount("shop", entry);
  const slot = Math.min(index, steps - 1);
  const step = lastSceneStepIndex(sceneLocalMs);
  return step > slot || (step === slot && obtainLanded(lastSceneBeatProgress(sceneLocalMs)));
}

export function shopObtainsAtStep(entry: ReplayHistoryEntry, step: number): ShopObtain[] {
  const queue = shopObtainQueue(entry);
  const steps = lastSceneStepCount("shop", entry);
  return queue.filter((_, index) => Math.min(index, steps - 1) === step);
}

export function lastSceneIdSetHas(ids: ReadonlySet<string> | undefined, id: string): boolean {
  if (!ids || ids.size === 0) return false;
  if (ids.has(id)) return true;
  const key = normalizeObtainId(id);
  for (const item of ids) {
    if (normalizeObtainId(item) === key) return true;
  }
  return false;
}

function pickedRelicIds(entry: ReplayHistoryEntry): string[] {
  return (entry.relic_choices ?? []).filter((choice) => choice.picked && choice.id).map((choice) => choice.id);
}

function pickedPotionIds(entry: ReplayHistoryEntry): string[] {
  return (entry.potion_choices ?? []).filter((choice) => choice.picked && choice.id).map((choice) => choice.id);
}

/** Relic icons stay invisible in the topbar until their obtain fly lands. */
export function lastSceneHiddenRelicIds(
  kind: LastSceneKind,
  entry: ReplayHistoryEntry,
  sceneLocalMs: number,
): Set<string> {
  if (kind === "combat" || kind === "treasure") {
    const localKind = kind === "treasure" ? "treasure" : "combat";
    const loot = combatLootSpecs(entry);
    const phase = lastScenePhase(localKind, entry, sceneLocalMs);
    const hidden = new Set<string>();
    if (phase.kind === "cards") return hidden;
    const resolvedCount = phase.kind === "loot" ? phase.resolvedCount : -1;
    const beatProgress = phase.kind === "loot" ? phase.beatProgress : 0;
    loot.forEach((spec, index) => {
      if (spec.kind !== "relic" || !spec.choice.picked || !spec.choice.id) return;
      const landed =
        resolvedCount > index || (resolvedCount === index && obtainLanded(beatProgress));
      if (!landed) hidden.add(spec.choice.id);
    });
    return hidden;
  }
  if (kind === "shop") {
    const hidden = new Set<string>();
    for (const item of shopObtainQueue(entry)) {
      if (item.kind !== "relic") continue;
      if (!shopObtainLanded(entry, item.id, "relic", sceneLocalMs)) hidden.add(item.id);
    }
    return hidden;
  }
  if (kind === "event" || kind === "ancient") {
    const phase = lastScenePhase(kind, entry, sceneLocalMs);
    if (phase.kind === "loot") {
      const loot = combatLootSpecs(entry);
      const hidden = new Set<string>();
      loot.forEach((spec, index) => {
        if (spec.kind !== "relic" || !spec.choice.picked || !spec.choice.id) return;
        const landed =
          phase.resolvedCount > index || (phase.resolvedCount === index && obtainLanded(phase.beatProgress));
        if (!landed) hidden.add(spec.choice.id);
      });
      return hidden;
    }
    if (phase.kind === "cards" || phase.kind === "upgrade" || phase.kind === "dead") return new Set();
    if (phase.kind !== "receipt") return new Set(pickedRelicIds(entry));
    return obtainLanded(phase.beatProgress) ? new Set() : new Set(pickedRelicIds(entry));
  }
  return new Set();
}

export function lastSceneHiddenPotionIds(
  kind: LastSceneKind,
  entry: ReplayHistoryEntry,
  sceneLocalMs: number,
): Set<string> {
  if (kind === "combat" || kind === "treasure") {
    const localKind = kind === "treasure" ? "treasure" : "combat";
    const loot = combatLootSpecs(entry);
    const phase = lastScenePhase(localKind, entry, sceneLocalMs);
    const hidden = new Set<string>();
    if (phase.kind === "cards") return hidden;
    const resolvedCount = phase.kind === "loot" ? phase.resolvedCount : -1;
    const beatProgress = phase.kind === "loot" ? phase.beatProgress : 0;
    loot.forEach((spec, index) => {
      if (spec.kind !== "potion" || !spec.choice.picked || !spec.choice.id) return;
      const landed =
        resolvedCount > index || (resolvedCount === index && obtainLanded(beatProgress));
      if (!landed) hidden.add(spec.choice.id);
    });
    return hidden;
  }
  if (kind === "shop") {
    const hidden = new Set<string>();
    for (const item of shopObtainQueue(entry)) {
      if (item.kind !== "potion") continue;
      if (!shopObtainLanded(entry, item.id, "potion", sceneLocalMs)) hidden.add(item.id);
    }
    return hidden;
  }
  if (kind === "event" || kind === "ancient") {
    const phase = lastScenePhase(kind, entry, sceneLocalMs);
    if (phase.kind === "loot") {
      const loot = combatLootSpecs(entry);
      const hidden = new Set<string>();
      loot.forEach((spec, index) => {
        if (spec.kind !== "potion" || !spec.choice.picked || !spec.choice.id) return;
        const landed =
          phase.resolvedCount > index || (phase.resolvedCount === index && obtainLanded(phase.beatProgress));
        if (!landed) hidden.add(spec.choice.id);
      });
      return hidden;
    }
    if (phase.kind === "cards" || phase.kind === "upgrade" || phase.kind === "dead") return new Set();
    if (phase.kind !== "receipt") return new Set(pickedPotionIds(entry));
    return obtainLanded(phase.beatProgress) ? new Set() : new Set(pickedPotionIds(entry));
  }
  return new Set();
}

/** Whether any last-scene obtain has started (used by potion-use delay). */
export function lastScenePicksRevealed(
  kind: LastSceneKind,
  entry: ReplayHistoryEntry,
  sceneLocalMs: number,
): boolean {
  const phase = lastScenePhase(kind, entry, sceneLocalMs);
  if (phase.kind === "cards" || phase.kind === "upgrade") return true;
  if (phase.kind === "shop") {
    return phase.step > 0 || obtainLanded(phase.beatProgress);
  }
  if (phase.kind === "loot") {
    return phase.resolvedCount > 0 || obtainLanded(phase.beatProgress);
  }
  if (phase.kind === "receipt") return obtainLanded(phase.beatProgress);
  return false;
}

export function normalizeObtainId(id: string): string {
  return stripReplayId(id).toUpperCase();
}
