import {
  type ReplayActAnalysis,
  type ReplayHistoryEntry,
  type ReplayRun,
} from "@/lib/sts2-run-replay";

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
  bossInfo: BossInfo;
  ancientInfo: AncientInfo;
  deck: { id: string; count: number }[];
  deckCount: number;
  elapsedSeconds: number;
}

const POTION_SLOT_RELIC_BONUS: Record<string, number> = {
  POTION_BELT: 1,
  PHIAL_HOLSTER: 1,
  ALCHEMICAL_COFFER: 1,
};

function normalize(id: string): string {
  return id.toUpperCase().split(".").pop() ?? id.toUpperCase();
}

function nodeWeightSeconds(entry: ReplayHistoryEntry): number {
  const turns = (entry.rooms ?? []).reduce(
    (sum, r) => sum + Math.max(0, r.turns_taken ?? 0),
    0,
  );
  const turnSeconds = turns * 8;
  switch (entry.map_point_type) {
    case "monster":
      return Math.max(8, turnSeconds);
    case "elite":
      return Math.max(15, turnSeconds);
    case "boss":
      return Math.max(25, turnSeconds);
    case "rest_site":
      return 8;
    case "treasure":
      return 6;
    case "shop":
      return 20;
    case "ancient":
      return 12;
    case "unknown":
      return Math.max(10, turnSeconds);
    default:
      return 10;
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
      deckCount: 0,
      elapsedSeconds: 0,
    };
  }

  const safeStep = Math.max(1, Math.min(step, act.history.length));
  const currentFloor = act.baseFloor + safeStep - 1;
  const currentEntry = act.history[safeStep - 1] ?? null;

  let hp: number | null = null;
  let maxHp: number | null = null;
  let gold: number | null = null;
  let elapsed = 0;
  let floor = 1;
  outer: for (const pastAct of run.map_point_history) {
    for (const entry of pastAct) {
      if (floor > currentFloor) break outer;
      if (typeof entry.current_hp === "number") hp = entry.current_hp;
      if (typeof entry.max_hp === "number") maxHp = entry.max_hp;
      if (typeof entry.current_gold === "number") gold = entry.current_gold;
      elapsed += nodeWeightSeconds(entry);
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

  const deck = buildDeckAtFloor(run, currentFloor);
  const deckCount = deck.reduce((sum, d) => sum + d.count, 0);

  return {
    hp,
    maxHp,
    gold,
    currentEntry,
    currentFloor,
    relics,
    potionSlots,
    bossInfo,
    ancientInfo,
    deck,
    deckCount,
    elapsedSeconds: elapsed,
  };
}

function buildDeckAtFloor(
  run: ReplayRun,
  currentFloor: number,
): { id: string; count: number }[] {
  const player = run.players[0];
  if (!player) return [];

  // Starter deck: every card in the final deck added at floor <= 1.
  const counts = new Map<string, number>();
  const starter = new Map<string, number>();
  for (const card of player.deck) {
    const f = card.floor_added_to_deck ?? 1;
    if (f <= 1) {
      starter.set(card.id, (starter.get(card.id) ?? 0) + 1);
    }
  }

  // History walk #1: detect starter cards that were later removed (so they
  // don't appear in the final deck). A removal whose card was never seen in
  // cards_gained must be a starter card.
  const seenGains = new Map<string, number>();
  for (const act of run.map_point_history) {
    for (const entry of act) {
      for (const c of entry.cards_gained ?? []) {
        if (!c.id) continue;
        seenGains.set(c.id, (seenGains.get(c.id) ?? 0) + 1);
      }
      const removals = [
        ...(entry.cards_lost ?? []),
        ...(entry.cards_removed ?? []),
      ];
      for (const c of removals) {
        if (!c.id) continue;
        const gained = seenGains.get(c.id) ?? 0;
        if (gained > 0) {
          seenGains.set(c.id, gained - 1);
        } else {
          starter.set(c.id, (starter.get(c.id) ?? 0) + 1);
        }
      }
    }
  }

  for (const [id, count] of starter) counts.set(id, count);

  // History walk #2: apply gains/losses up to currentFloor.
  let floor = 1;
  outer: for (const act of run.map_point_history) {
    for (const entry of act) {
      if (floor > currentFloor) break outer;
      for (const c of entry.cards_gained ?? []) {
        if (!c.id) continue;
        counts.set(c.id, (counts.get(c.id) ?? 0) + 1);
      }
      for (const c of entry.cards_lost ?? []) {
        if (!c.id) continue;
        const cur = counts.get(c.id) ?? 0;
        if (cur > 1) counts.set(c.id, cur - 1);
        else counts.delete(c.id);
      }
      for (const c of entry.cards_removed ?? []) {
        if (!c.id) continue;
        const cur = counts.get(c.id) ?? 0;
        if (cur > 1) counts.set(c.id, cur - 1);
        else counts.delete(c.id);
      }
      floor += 1;
    }
  }

  return Array.from(counts, ([id, count]) => ({ id, count })).sort((a, b) =>
    a.id.localeCompare(b.id),
  );
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
      for (const c of entry.cards_gained ?? []) if (c.id) ids.add(c.id);
      for (const c of entry.cards_lost ?? []) if (c.id) ids.add(c.id);
      for (const c of entry.cards_removed ?? []) if (c.id) ids.add(c.id);
      for (const c of entry.card_choices ?? []) if (c.id) ids.add(c.id);
    }
  }
  return Array.from(ids);
}
