import {
  type ReplayActAnalysis,
  type ReplayCardRef,
  type ReplayHistoryEntry,
  type ReplayRun,
} from "@/lib/sts2-run-replay";

function cardGainsOnEntry(entry: ReplayHistoryEntry): ReplayCardRef[] {
  return [
    ...(entry.cards_gained ?? []),
    ...(entry.cards_transformed ?? []).map((row) => row.final),
  ];
}

function cardLossesOnEntry(entry: ReplayHistoryEntry): ReplayCardRef[] {
  return (entry.cards_transformed ?? []).map((row) => row.original);
}

export interface RelicAtFloor {
  id: string;
  floor: number;
  justAcquired: boolean;
}

export interface BossInfo {
  firstBoss: string | null;
  secondBoss: string | null;
  // Step lifecycle: where is the player relative to each boss step.
  firstBossActive: boolean;   // current step IS the first boss room
  firstBossPassed: boolean;   // we already moved past the first boss room
  secondBossActive: boolean;  // current step IS the second boss room (A10 act3)
  secondBossPassed: boolean;
}

export interface AncientInfo {
  // Run-history sprite name (no extension), e.g. "neow", "darv", "vakuu".
  // Null when this act has no ancient room.
  spriteId: string | null;
  // True while the player is *on* the ancient node (active highlight).
  active: boolean;
  // True after the ancient room has been passed.
  passed: boolean;
}

export interface TopbarState {
  hp: number | null;
  maxHp: number | null;
  gold: number | null;
  currentEntry: ReplayHistoryEntry | null;
  currentFloor: number;
  relics: RelicAtFloor[];
  potionSlots: number;
  potions: (string | null)[];
  bossInfo: BossInfo;
  ancientInfo: AncientInfo;
  deck: HistoryDeckGroup[];
  deckCopies: HistoryDeckCopy[];
  deckCount: number;
}

export interface HistoryDeckCopy {
  id: string;
  upgradeLevel: number;
  floorAdded: number;
  enchantmentId?: string;
  enchantmentAmount?: number;
}

export interface HistoryDeckGroup {
  id: string;
  count: number;
  /** Upgrade level shared by every copy in this group (SerializableCard.Equals). */
  upgradeCount: number;
  firstFloor: number;
  enchantmentId?: string;
  enchantmentAmount?: number;
}

const POTION_SLOT_RELIC_BONUS: Record<string, number> = {
  POTION_BELT: 1,
  PHIAL_HOLSTER: 1,
  ALCHEMICAL_COFFER: 1,
};

function normalize(id: string): string {
  return id.toUpperCase().split(".").pop() ?? id.toUpperCase();
}

function cardIdKey(id: string): string {
  return normalize(id);
}

const CARD = (id: string) => `CARD.${id}`;

const STARTING_DECK_BY_CHARACTER: Record<string, string[]> = {
  IRONCLAD: [
    ...Array(5).fill(CARD("STRIKE_IRONCLAD")),
    ...Array(4).fill(CARD("DEFEND_IRONCLAD")),
    CARD("BASH"),
  ],
  SILENT: [
    ...Array(5).fill(CARD("STRIKE_SILENT")),
    ...Array(5).fill(CARD("DEFEND_SILENT")),
    CARD("NEUTRALIZE"),
    CARD("SURVIVOR"),
  ],
  DEFECT: [
    ...Array(4).fill(CARD("STRIKE_DEFECT")),
    ...Array(4).fill(CARD("DEFEND_DEFECT")),
    CARD("ZAP"),
    CARD("DUALCAST"),
  ],
  NECROBINDER: [
    ...Array(4).fill(CARD("STRIKE_NECROBINDER")),
    ...Array(4).fill(CARD("DEFEND_NECROBINDER")),
    CARD("BODYGUARD"),
    CARD("UNLEASH"),
  ],
  REGENT: [
    ...Array(4).fill(CARD("STRIKE_REGENT")),
    ...Array(4).fill(CARD("DEFEND_REGENT")),
    CARD("FALLING_STAR"),
    CARD("VENERATE"),
  ],
  RANDOM_CHARACTER: [
    CARD("STRIKE_IRONCLAD"),
    CARD("STRIKE_SILENT"),
    CARD("STRIKE_REGENT"),
    CARD("STRIKE_NECROBINDER"),
    CARD("STRIKE_DEFECT"),
    CARD("DEFEND_IRONCLAD"),
    CARD("DEFEND_SILENT"),
    CARD("DEFEND_REGENT"),
    CARD("DEFEND_NECROBINDER"),
    CARD("DEFEND_DEFECT"),
  ],
  DEPRIVED: [],
};

function startingDeckIds(character: string): string[] {
  const key = character.replace(/^CHARACTER\./, "").toUpperCase();
  if (key === "RANDOM") return STARTING_DECK_BY_CHARACTER.RANDOM_CHARACTER;
  return STARTING_DECK_BY_CHARACTER[key] ?? [];
}

function copyFromRef(card: ReplayCardRef, fallbackFloor: number): HistoryDeckCopy | null {
  if (!card.id) return null;
  const copy: HistoryDeckCopy = {
    id: card.id,
    upgradeLevel: card.current_upgrade_level ?? 0,
    floorAdded: fallbackFloor,
  };
  if (card.enchantment?.id) {
    copy.enchantmentId = card.enchantment.id;
    if (typeof card.enchantment.amount === "number") {
      copy.enchantmentAmount = card.enchantment.amount;
    }
  }
  return copy;
}

function enchantKey(copy: {
  enchantmentId?: string;
  enchantmentAmount?: number;
}): string {
  if (!copy.enchantmentId) return "";
  return `${cardIdKey(copy.enchantmentId)}:${copy.enchantmentAmount ?? 0}`;
}

function groupKey(copy: HistoryDeckCopy): string {
  return `${cardIdKey(copy.id)}|${copy.upgradeLevel}|${enchantKey(copy)}`;
}

function floorMatches(copyFloor: number, wantFloor?: number): boolean {
  if (wantFloor == null) return true;
  if (copyFloor === wantFloor) return true;
  return copyFloor === 0 && wantFloor === 1;
}

function findRemoveIndex(copies: HistoryDeckCopy[], ref: ReplayCardRef): number {
  if (!ref.id) return -1;
  const key = cardIdKey(ref.id);
  let exact = -1;
  let unenchanted = -1;
  let any = -1;
  for (let i = 0; i < copies.length; i++) {
    const copy = copies[i];
    if (cardIdKey(copy.id) !== key) continue;
    if (any < 0) any = i;
    const upgradeOk =
      ref.current_upgrade_level == null || copy.upgradeLevel === ref.current_upgrade_level;
    const floorOk = floorMatches(copy.floorAdded, ref.floor_added_to_deck);
    if (!upgradeOk || !floorOk) continue;
    const wantEnchant = ref.enchantment?.id;
    const copyEnchant = copy.enchantmentId;
    const enchantOk = wantEnchant
      ? copyEnchant != null &&
        cardIdKey(copyEnchant) === cardIdKey(wantEnchant) &&
        (ref.enchantment?.amount == null ||
          (copy.enchantmentAmount ?? 0) === (ref.enchantment.amount ?? 0))
      : !copyEnchant;
    if (enchantOk && exact < 0) exact = i;
    if (!copyEnchant && unenchanted < 0) unenchanted = i;
  }
  if (exact >= 0) return exact;
  if (!ref.enchantment?.id && unenchanted >= 0) return unenchanted;
  return any;
}

function findUpgradeIndex(copies: HistoryDeckCopy[], id: string): number {
  const key = cardIdKey(id);
  const unupgraded = copies.findIndex(
    (copy) => cardIdKey(copy.id) === key && copy.upgradeLevel === 0,
  );
  if (unupgraded >= 0) return unupgraded;
  return copies.findIndex((copy) => cardIdKey(copy.id) === key);
}

function findEnchantIndex(
  copies: HistoryDeckCopy[],
  row: {
    cardId: string;
    upgradeLevel?: number;
    floorAdded?: number;
  },
): number {
  const key = cardIdKey(row.cardId);
  let unenchanted = -1;
  let any = -1;
  for (let i = 0; i < copies.length; i++) {
    const copy = copies[i];
    if (cardIdKey(copy.id) !== key) continue;
    if (any < 0) any = i;
    if (copy.enchantmentId) continue;
    const upgradeOk = row.upgradeLevel == null || copy.upgradeLevel === row.upgradeLevel;
    const floorOk = floorMatches(copy.floorAdded, row.floorAdded);
    if (upgradeOk && floorOk) return i;
    if (unenchanted < 0) unenchanted = i;
  }
  if (unenchanted >= 0) return unenchanted;
  return any;
}

function leftoverStarterCounts(run: ReplayRun): Map<string, number> {
  const player = run.players[0];
  const starter = new Map<string, number>();
  if (!player) return starter;

  const gainedRemaining = new Map<string, number>();
  for (const act of run.map_point_history) {
    for (const entry of act) {
      for (const card of cardGainsOnEntry(entry)) {
        if (!card.id) continue;
        gainedRemaining.set(card.id, (gainedRemaining.get(card.id) ?? 0) + 1);
      }
    }
  }

  for (const card of player.deck) {
    const added = card.floor_added_to_deck ?? 1;
    if (added > 1 || !card.id) continue;
    const remaining = gainedRemaining.get(card.id) ?? 0;
    if (remaining > 0) {
      gainedRemaining.set(card.id, remaining - 1);
      continue;
    }
    starter.set(card.id, (starter.get(card.id) ?? 0) + 1);
  }

  const seenGains = new Map<string, number>();
  for (const act of run.map_point_history) {
    for (const entry of act) {
      for (const card of cardGainsOnEntry(entry)) {
        if (!card.id) continue;
        seenGains.set(card.id, (seenGains.get(card.id) ?? 0) + 1);
      }
      const removals = [
        ...(entry.cards_lost ?? []),
        ...(entry.cards_removed ?? []),
        ...cardLossesOnEntry(entry),
      ];
      for (const card of removals) {
        if (!card.id) continue;
        const gained = seenGains.get(card.id) ?? 0;
        if (gained > 0) {
          seenGains.set(card.id, gained - 1);
        } else {
          starter.set(card.id, (starter.get(card.id) ?? 0) + 1);
        }
      }
    }
  }

  return starter;
}

function emitStartingCopies(character: string, leftover: Map<string, number>): HistoryDeckCopy[] {
  const remaining = new Map(leftover);
  const copies: HistoryDeckCopy[] = [];
  for (const id of startingDeckIds(character)) {
    const count = remaining.get(id) ?? 0;
    if (count <= 0) continue;
    copies.push({ id, upgradeLevel: 0, floorAdded: 0 });
    remaining.set(id, count - 1);
  }
  for (const [id, count] of remaining) {
    for (let i = 0; i < count; i++) {
      copies.push({ id, upgradeLevel: 0, floorAdded: 0 });
    }
  }
  return copies;
}

function padMissingSnapshotCopies(
  copies: HistoryDeckCopy[],
  run: ReplayRun,
  currentFloor: number,
): void {
  const player = run.players[0];
  if (!player) return;
  const remaining = copies.map((_, index) => index);
  for (const card of player.deck) {
    if (!card.id) continue;
    const added = card.floor_added_to_deck ?? 1;
    if (added > currentFloor) continue;
    const match = remaining.findIndex((index) => cardIdKey(copies[index].id) === cardIdKey(card.id));
    if (match >= 0) {
      remaining.splice(match, 1);
      continue;
    }
    copies.push({
      id: card.id,
      upgradeLevel: 0,
      floorAdded: added <= 1 ? 0 : added,
    });
  }
}

export function buildTopbarState(
  analysis: { run: ReplayRun; acts: ReplayActAnalysis[] },
  actIndex: number,
  step: number,
): TopbarState {
  const { run, acts } = analysis;
  const player = run.players[0];
  const act = acts[actIndex];
  if (!player || !act) {
    return {
      hp: null,
      maxHp: null,
      gold: null,
      currentEntry: null,
      currentFloor: 1,
      relics: [],
      potionSlots: run.ascension >= 6 ? 2 : 3,
      potions: Array.from({ length: run.ascension >= 6 ? 2 : 3 }, () => null),
      bossInfo: {
        firstBoss: null,
        secondBoss: null,
        firstBossActive: false,
        firstBossPassed: false,
        secondBossActive: false,
        secondBossPassed: false,
      },
      ancientInfo: { spriteId: null, active: false, passed: false },
      deck: [],
      deckCopies: [],
      deckCount: 0,
    };
  }

  const safeStep = Math.max(1, Math.min(step, act.history.length));
  const currentFloor = act.baseFloor + safeStep - 1;
  const currentEntry = act.history[safeStep - 1] ?? null;

  let hp: number | null = null;
  let maxHp: number | null = null;
  let gold: number | null = null;
  let floor = 1;
  outer: for (const pastAct of run.map_point_history) {
    for (const entry of pastAct) {
      if (floor > currentFloor) break outer;
      if (typeof entry.current_hp === "number") hp = entry.current_hp;
      if (typeof entry.max_hp === "number") maxHp = entry.max_hp;
      if (typeof entry.current_gold === "number") gold = entry.current_gold;
      floor += 1;
    }
  }

  const relics: RelicAtFloor[] = [];
  for (const relic of player.relics) {
    if (typeof relic.id !== "string") continue;
    const floorAdded = relic.floor_added_to_deck ?? 0;
    if (floorAdded <= 0 || floorAdded > currentFloor) continue;
    relics.push({
      id: relic.id,
      floor: floorAdded,
      justAcquired: floorAdded === currentFloor,
    });
  }
  relics.sort((a, b) => a.floor - b.floor);

  let potionSlots = run.ascension >= 6 ? 2 : 3;
  for (const relic of relics) {
    const bonus = POTION_SLOT_RELIC_BONUS[normalize(relic.id)];
    if (bonus) potionSlots += bonus;
  }
  const finalFloor = run.map_point_history.reduce((sum, history) => sum + history.length, 0);
  if (
    currentFloor >= finalFloor &&
    typeof player.maxPotionSlotCount === "number" &&
    player.maxPotionSlotCount > 0
  ) {
    potionSlots = player.maxPotionSlotCount;
  }
  const potions = buildPotionSlotsAtFloor(run, currentFloor, potionSlots);

  const bossStepIndices = act.history
    .map((entry, i) => (entry.map_point_type === "boss" ? i : -1))
    .filter((i) => i >= 0);
  const firstBossStep = bossStepIndices[0] ?? -1;
  const secondBossStep = bossStepIndices[1] ?? -1;
  const stepIdx = safeStep - 1;
  const bossInfo: BossInfo = {
    firstBoss: act.predictedFirstBoss,
    secondBoss: act.predictedSecondBoss,
    firstBossActive: firstBossStep >= 0 && stepIdx === firstBossStep,
    firstBossPassed: firstBossStep >= 0 && stepIdx > firstBossStep,
    secondBossActive: secondBossStep >= 0 && stepIdx === secondBossStep,
    secondBossPassed: secondBossStep >= 0 && stepIdx > secondBossStep,
  };

  const ancientStepIndex = act.history.findIndex(
    (entry) => entry.map_point_type === "ancient",
  );
  let ancientInfo: AncientInfo = { spriteId: null, active: false, passed: false };
  if (ancientStepIndex >= 0) {
    const ancientEntry = act.history[ancientStepIndex];
    const spriteId = normalize(ancientEntry?.rooms[0]?.model_id ?? "").toLowerCase() || null;
    const onIt = safeStep - 1 === ancientStepIndex;
    const past = safeStep - 1 > ancientStepIndex;
    ancientInfo = { spriteId, active: onIt, passed: past };
  }

  const deckCopies = buildDeckCopiesAtFloor(run, currentFloor);
  const deck = groupHistoryDeck(deckCopies);
  const deckCount = deckCopies.length;

  return {
    hp,
    maxHp,
    gold,
    currentEntry,
    currentFloor,
    relics,
    potionSlots,
    potions,
    bossInfo,
    ancientInfo,
    deck,
    deckCopies,
    deckCount,
  };
}

function removePotionFromSlots(slots: (string | null)[], id: string): boolean {
  const needle = normalize(id);
  const idx = slots.findIndex((slot) => (slot ? normalize(slot) === needle : false));
  if (idx < 0) return false;
  slots[idx] = null;
  return true;
}

function addPotionToSlots(slots: (string | null)[], id: string): void {
  const idx = slots.findIndex((slot) => slot === null);
  if (idx < 0) return;
  slots[idx] = id;
}

function exactFinalPotionSlots(run: ReplayRun, potionSlots: number): (string | null)[] | null {
  const player = run.players[0];
  if (!player || player.potions.length === 0) return null;
  const slots = Array.from({ length: potionSlots }, () => null as string | null);
  for (const potion of player.potions) {
    const preferred =
      typeof potion.slotIndex === "number" &&
      potion.slotIndex >= 0 &&
      potion.slotIndex < slots.length
        ? potion.slotIndex
        : slots.findIndex((slot) => slot === null);
    if (preferred >= 0) slots[preferred] = potion.id;
  }
  return slots;
}

function buildPotionSlotsAtFloor(
  run: ReplayRun,
  currentFloor: number,
  potionSlots: number,
): (string | null)[] {
  const slots = Array.from({ length: potionSlots }, () => null as string | null);
  let floor = 1;
  outer: for (const act of run.map_point_history) {
    for (const entry of act) {
      if (floor > currentFloor) break outer;
      const remainingRemovals: string[] = [];
      for (const id of [...(entry.potion_used ?? []), ...(entry.potion_discarded ?? [])]) {
        if (!removePotionFromSlots(slots, id)) remainingRemovals.push(id);
      }
      for (const choice of entry.potion_choices ?? []) {
        if (choice.picked && choice.id) addPotionToSlots(slots, choice.id);
      }
      for (const id of remainingRemovals) {
        removePotionFromSlots(slots, id);
      }
      floor += 1;
    }
  }

  const finalFloor = run.map_point_history.reduce((sum, history) => sum + history.length, 0);
  return currentFloor >= finalFloor ? (exactFinalPotionSlots(run, potionSlots) ?? slots) : slots;
}

export function groupHistoryDeck(copies: HistoryDeckCopy[]): HistoryDeckGroup[] {
  const groups: HistoryDeckGroup[] = [];
  const indexByKey = new Map<string, number>();
  for (const copy of copies) {
    const key = groupKey(copy);
    const existing = indexByKey.get(key);
    if (existing != null) {
      groups[existing].count += 1;
      continue;
    }
    indexByKey.set(key, groups.length);
    groups.push({
      id: copy.id,
      count: 1,
      upgradeCount: copy.upgradeLevel,
      firstFloor: copy.floorAdded,
      enchantmentId: copy.enchantmentId,
      enchantmentAmount: copy.enchantmentAmount,
    });
  }
  return groups;
}

export function buildDeckCopiesAtFloor(
  run: ReplayRun,
  currentFloor: number,
): HistoryDeckCopy[] {
  const player = run.players[0];
  if (!player) return [];

  const copies = emitStartingCopies(
    player.character,
    leftoverStarterCounts(run),
  );

  let floor = 1;
  outer: for (const act of run.map_point_history) {
    for (const entry of act) {
      if (floor > currentFloor) break outer;
      for (const card of cardGainsOnEntry(entry)) {
        const copy = copyFromRef(card, floor);
        if (copy) copies.push(copy);
      }
      for (const card of [
        ...(entry.cards_lost ?? []),
        ...cardLossesOnEntry(entry),
        ...(entry.cards_removed ?? []),
      ]) {
        const index = findRemoveIndex(copies, card);
        if (index >= 0) copies.splice(index, 1);
      }
      for (const id of entry.upgraded_cards ?? []) {
        const index = findUpgradeIndex(copies, id);
        if (index >= 0) copies[index].upgradeLevel += 1;
      }
      for (const row of entry.cards_enchanted ?? []) {
        if (!row.cardId || !row.enchantmentId) continue;
        const index = findEnchantIndex(copies, row);
        if (index < 0) continue;
        copies[index].enchantmentId = row.enchantmentId;
        copies[index].enchantmentAmount = row.amount;
      }
      floor += 1;
    }
  }

  padMissingSnapshotCopies(copies, run, currentFloor);
  return copies;
}

export function buildDeckAtFloor(
  run: ReplayRun,
  currentFloor: number,
): HistoryDeckGroup[] {
  return groupHistoryDeck(buildDeckCopiesAtFloor(run, currentFloor));
}

export function collectRelevantCardIds(run: ReplayRun): string[] {
  const ids = new Set<string>();
  for (const player of run.players) {
    for (const c of player.deck) {
      if (c.id) ids.add(c.id);
    }
  }
  for (const act of run.map_point_history) {
    for (const entry of act) {
      for (const c of cardGainsOnEntry(entry)) if (c.id) ids.add(c.id);
      for (const c of entry.cards_lost ?? []) if (c.id) ids.add(c.id);
      for (const c of entry.cards_removed ?? []) if (c.id) ids.add(c.id);
      for (const row of entry.cards_transformed ?? []) {
        if (row.original.id) ids.add(row.original.id);
        if (row.final.id) ids.add(row.final.id);
      }
      for (const c of entry.card_choices ?? []) if (c.id) ids.add(c.id);
      for (const id of entry.upgraded_cards ?? []) if (id) ids.add(id);
      for (const c of entry.cards_enchanted ?? []) if (c.cardId) ids.add(c.cardId);
    }
  }
  return Array.from(ids);
}
