import type { LastSceneKind } from "@/lib/history-last-scene";
import {
  isLanternKeyFight,
  isSlipperyBridgeEntry,
  stripReplayId,
} from "@/lib/history-last-scene";
import type { ReplayCardRef, ReplayChoice, ReplayHistoryEntry } from "@/lib/sts2-run-replay";

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
  | { kind: "special-card"; card: ReplayCardRef }
  | { kind: "cards" };

export type LastScenePhase =
  | { kind: "alive" }
  | { kind: "dying" }
  | { kind: "dead" }
  | { kind: "loot"; resolvedCount: number; total: number; beatProgress: number }
  | { kind: "cards"; beatProgress: number }
  | { kind: "choice"; beatProgress: number; slipperyHoldIndex?: number }
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
  if (spec.kind === "gold" || spec.kind === "card-removal" || spec.kind === "special-card") return true;
  if (spec.kind === "potion" || spec.kind === "relic") return Boolean(spec.choice.picked);
  return (entry.card_choices ?? []).some((choice) => choice.picked);
}

export function specialCardGains(entry: ReplayHistoryEntry): ReplayCardRef[] {
  const offered = new Set(
    (entry.card_choices ?? []).map((choice) => stripReplayId(choice.id).toUpperCase()),
  );
  return (entry.cards_gained ?? []).filter((card) => {
    if (!card.id) return false;
    return !offered.has(stripReplayId(card.id).toUpperCase());
  });
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
  for (const card of specialCardGains(entry)) {
    items.push({ kind: "special-card", card });
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
      if (isSlipperyBridgeEntry(entry)) {
        return Math.max(2, slipperyHoldCount(entry) + 1);
      }
      return eventNonCombatStepCount(entry);
    case "ancient":
      return 2 + (hasCenteredUpgradeFollowUp(entry) ? 1 : 0);
    case "rest":
      return 2;
    case "shop":
      return Math.max(3, shopObtainQueue(entry).length + 1);
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
  if (kind === "event" && isSlipperyBridgeEntry(entry)) {
    const holds = slipperyHoldCount(entry);
    const holdSteps = Math.max(1, lastSceneStepCount("event", entry) - 1);
    if (step < holdSteps) {
      return {
        kind: "choice",
        beatProgress,
        slipperyHoldIndex: Math.min(step, Math.max(0, holds - 1)),
      };
    }
    return { kind: "receipt", beatProgress };
  }
  if (kind === "event") {
    return eventNonCombatPhase(entry, step, beatProgress);
  }
  if (kind === "ancient" || kind === "rest") {
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

function eventLootFollowUp(entry: ReplayHistoryEntry): {
  loot: CombatLootSpec[];
  cardPicker: boolean;
  upgrade: boolean;
} {
  const loot = combatLootSpecs(entry);
  return {
    loot,
    cardPicker: combatShowsCardPicker(entry),
    upgrade: hasCenteredUpgradeFollowUp(entry),
  };
}

function eventNonCombatStepCount(entry: ReplayHistoryEntry): number {
  const follow = eventLootFollowUp(entry);
  const outcome = follow.loot.length + (follow.cardPicker ? 1 : 0) || 1;
  return 1 + outcome + (follow.upgrade ? 1 : 0);
}

function eventNonCombatPhase(
  entry: ReplayHistoryEntry,
  step: number,
  beatProgress: number,
): LastScenePhase {
  if (step <= 0) return { kind: "choice", beatProgress };
  const follow = eventLootFollowUp(entry);
  if (follow.loot.length > 0) {
    const lootStep = step - 1;
    if (lootStep < follow.loot.length) {
      return {
        kind: "loot",
        resolvedCount: lootStep,
        total: follow.loot.length,
        beatProgress,
      };
    }
    if (follow.cardPicker && lootStep === follow.loot.length) {
      return { kind: "cards", beatProgress };
    }
    const afterLoot = 1 + follow.loot.length + (follow.cardPicker ? 1 : 0);
    if (follow.upgrade && step >= afterLoot) return { kind: "upgrade", beatProgress };
    return {
      kind: "loot",
      resolvedCount: follow.loot.length,
      total: follow.loot.length,
      beatProgress: 1,
    };
  }
  if (follow.upgrade && step >= 2) return { kind: "upgrade", beatProgress };
  return { kind: "receipt", beatProgress };
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

/** Step 0 is idle browsing so the full first row is visible before buys. */
const SHOP_BROWSE_STEPS = 1;

function shopObtainSlot(index: number, steps: number): number {
  return Math.min(index + SHOP_BROWSE_STEPS, steps - 1);
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
  const obtainStep = index + SHOP_BROWSE_STEPS;
  if (step > obtainStep) return true;
  const hideAfter = kind === "card" ? 0.04 : 0.12;
  return step === obtainStep && beatProgress > hideAfter;
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
  const obtainStep = index + SHOP_BROWSE_STEPS;
  if (step < obtainStep) return 0;
  if (step > obtainStep) return 1;
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
  if (step !== index + SHOP_BROWSE_STEPS) return false;
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
  const slot = shopObtainSlot(index, steps);
  const step = lastSceneStepIndex(sceneLocalMs);
  return step > slot || (step === slot && obtainLanded(lastSceneBeatProgress(sceneLocalMs)));
}

export function shopObtainsAtStep(entry: ReplayHistoryEntry, step: number): ShopObtain[] {
  const queue = shopObtainQueue(entry);
  const steps = lastSceneStepCount("shop", entry);
  return queue.filter((_, index) => shopObtainSlot(index, steps) === step);
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
    return phase.step > SHOP_BROWSE_STEPS || (phase.step === SHOP_BROWSE_STEPS && obtainLanded(phase.beatProgress));
  }
  if (phase.kind === "loot") {
    return phase.resolvedCount > 0 || obtainLanded(phase.beatProgress);
  }
  if (phase.kind === "receipt") return obtainLanded(phase.beatProgress);
  return false;
}

export function slipperyHoldCount(entry: ReplayHistoryEntry): number {
  return (entry.event_choices ?? []).filter((choice) => {
    const id = stripReplayId(choice.id).toUpperCase();
    const key = (choice.locKey ?? "").toUpperCase();
    return id.startsWith("HOLD_ON") || /\.HOLD_ON/.test(key);
  }).length;
}

/** Game `CurrentHpLoss` starts at 3 and increments by 1 after each Hold On. */
export function slipperyHpLossAtHold(holdIndex: number): number {
  return 3 + Math.max(0, holdIndex);
}

export function entryGoldBeforeFloor(entry: ReplayHistoryEntry): number | null {
  if (typeof entry.current_gold !== "number") return null;
  return entry.current_gold
    - (entry.gold_gained ?? 0)
    + (entry.gold_spent ?? 0)
    + (entry.gold_lost ?? 0);
}

export function lastSceneGoldRevealed(
  kind: LastSceneKind,
  entry: ReplayHistoryEntry,
  sceneLocalMs: number,
): boolean {
  const gained = entry.gold_gained ?? 0;
  const spent = entry.gold_spent ?? 0;
  const lost = entry.gold_lost ?? 0;
  if (gained === 0 && spent === 0 && lost === 0) return true;
  const phase = lastScenePhase(kind, entry, sceneLocalMs);
  const goldIndex = combatLootSpecs(entry).findIndex((spec) => spec.kind === "gold");
  if (goldIndex >= 0) {
    if (phase.kind === "loot") {
      return phase.resolvedCount > goldIndex
        || (phase.resolvedCount === goldIndex && obtainLanded(phase.beatProgress));
    }
    return phase.kind === "cards" || phase.kind === "dead" || phase.kind === "upgrade";
  }
  if (phase.kind === "shop") {
    return phase.step > SHOP_BROWSE_STEPS
      || (phase.step === SHOP_BROWSE_STEPS && obtainLanded(phase.beatProgress));
  }
  if (phase.kind === "receipt") return obtainLanded(phase.beatProgress);
  return phase.kind === "upgrade" || phase.kind === "cards";
}

export function lastSceneDisplayedGold(
  kind: LastSceneKind,
  entry: ReplayHistoryEntry,
  sceneLocalMs: number,
): number | null {
  const end = entry.current_gold;
  if (typeof end !== "number") return null;
  if (lastSceneGoldRevealed(kind, entry, sceneLocalMs)) return end;
  return entryGoldBeforeFloor(entry);
}

export function lastSceneDisplayedHp(
  kind: LastSceneKind,
  entry: ReplayHistoryEntry,
  sceneLocalMs: number,
): number | null {
  if (!isSlipperyBridgeEntry(entry) || typeof entry.current_hp !== "number") return null;
  const start = entry.current_hp + (entry.damage_taken ?? 0);
  const phase = lastScenePhase(kind, entry, sceneLocalMs);
  const holds = slipperyHoldCount(entry);
  let resolved = 0;
  if (phase.kind === "choice") {
    if (holds > 0) {
      const holdIndex = phase.slipperyHoldIndex ?? 0;
      resolved = obtainLanded(phase.beatProgress) ? holdIndex + 1 : holdIndex;
    }
  } else {
    resolved = holds;
  }
  let hp = start;
  for (let i = 0; i < resolved; i++) hp -= slipperyHpLossAtHold(i);
  return hp;
}

export function cardRewardTokenKind(
  mapPointType: string,
  rarities: Array<string | undefined>,
): "rare" | "uncommon" | "common" {
  if (mapPointType === "boss") return "rare";
  const known = rarities.filter((rarity): rarity is string => Boolean(rarity));
  if (known.length === 0) return "common";
  const unique = new Set(known.map(normalizeCardRarityToken));
  if (unique.size !== 1) return "common";
  const [rarity] = unique;
  if (rarity === "rare") return "rare";
  if (rarity === "uncommon") return "uncommon";
  return "common";
}

function normalizeCardRarityToken(rarity: string): "rare" | "uncommon" | "common" | "other" {
  const key = rarity.trim().toLowerCase();
  if (key === "희귀" || key === "rare") return "rare";
  if (key === "고급" || key === "uncommon") return "uncommon";
  if (key === "일반" || key === "common") return "common";
  return "other";
}

export function normalizeObtainId(id: string): string {
  return stripReplayId(id).toUpperCase();
}
