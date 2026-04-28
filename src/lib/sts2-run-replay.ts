const INT_MAX = 2147483647;
const INT_MIN = -2147483648;
const MATCH_CAP = 256;
const MAP_COLUMNS = 7;

export type ReplayMapPointType =
  | "ancient"
  | "monster"
  | "unknown"
  | "elite"
  | "rest_site"
  | "treasure"
  | "shop"
  | "boss";

export interface ReplayRoom {
  room_type: string;
  model_id: string | null;
  turns_taken: number;
}

export interface ReplayChoice {
  id: string;
  picked: boolean;
}

export interface ReplayHistoryEntry {
  map_point_type: string;
  rooms: ReplayRoom[];
  current_hp?: number;
  max_hp?: number;
  current_gold?: number;
  damage_taken?: number;
  hp_healed?: number;
  max_hp_gained?: number;
  max_hp_lost?: number;
  gold_gained?: number;
  gold_spent?: number;
  gold_lost?: number;
  gold_stolen?: number;
  cards_gained?: { id?: string }[];
  cards_lost?: { id?: string }[];
  cards_removed?: { id?: string }[];
  upgraded_cards?: string[];
  cards_enchanted?: ReplayEnchantment[];
  card_choices?: ReplayChoice[];
  relic_choices?: ReplayChoice[];
  potion_choices?: ReplayChoice[];
}

export interface ReplayEnchantment {
  cardId: string;
  enchantmentId: string;
  amount?: number;
}

export interface ReplayDeckCard {
  id: string;
  floor_added_to_deck?: number;
  current_upgrade_level?: number;
}

export interface ReplayRelic {
  id: string;
  floor_added_to_deck?: number;
  intArrays?: Record<string, number[]>;
  ints?: Record<string, number>;
}

export interface ReplayPlayer {
  id: number;
  character: string;
  deck: ReplayDeckCard[];
  relics: ReplayRelic[];
}

export interface ReplayModifier {
  id?: string;
  name?: string;
}

export interface ReplayRun {
  seed: string;
  build_id: string;
  ascension: number;
  game_mode: string;
  win: boolean;
  acts: string[];
  players: ReplayPlayer[];
  modifiers: ReplayModifier[];
  map_point_history: ReplayHistoryEntry[][];
  run_time?: number;
  start_time?: number;
}

export interface ReplayMapNode {
  id: string;
  col: number;
  row: number;
  type: ReplayMapPointType;
}

export interface ReplayMapEdge {
  id: string;
  from: string;
  to: string;
}

export interface ReplayActAnalysis {
  actIndex: number;
  actId: string;
  actLabel: string;
  baseFloor: number;
  history: ReplayHistoryEntry[];
  historyTypes: ReplayMapPointType[];
  nodes: ReplayMapNode[];
  edges: ReplayMapEdge[];
  candidateNodeIdsByStep: string[][];
  candidateEdgeIdsByStep: string[][];
  matchedPathCount: number;
  matchedPathCountCapped: boolean;
  exactReplay: boolean;
  rowCount: number;
  mapVariant: ActMapVariant;
  // History indices where the matched path arrived via off-edge flight
  // (Winged Boots / Flight modifier). Only populated when exactReplay is true.
  flightStepIndices: number[];
  // Lowest flight budget that produced any matching path. Useful for tracking
  // boots charge consumption across acts.
  flightStepsUsed: number;
  // Node IDs marked by Fur Coat (Nonupeipe) — game shows a quest marker on
  // these. Empty unless this act is the act in which Fur Coat was obtained.
  furCoatMarkerNodeIds: string[];
  // Node ID marked by Spoils Map quest. Empty for non-spoils acts.
  spoilsMarkerNodeId: string | null;
  // Node IDs that the player arrived at via off-edge flight (Winged Boots).
  // Each of these gets a Winged Boots relic icon overlay in the UI.
  flightArrivalNodeIds: string[];
  // Possible boss IDs for this act (full pool from extracted game data).
  // Used by UI when the player didn't reach the boss — we can't know which
  // one was picked without simulating UpFront RNG, so surface candidates.
  bossPool: string[];
  // First boss predicted by `simulateActsUpFront` (mirrors C# RunManager's
  // UpFront RNG flow). UI prefers this over `bossPool` when rendering an
  // unreached boss icon, falling back to placeholder only if `null`.
  predictedFirstBoss: string | null;
  // DoubleBoss (A10) second boss for the final act, predicted from the same
  // RNG flow. `null` for non-final acts and non-A10 runs.
  predictedSecondBoss: string | null;
}

export interface ReplayAnalysis {
  run: ReplayRun;
  warnings: string[];
  acts: ReplayActAnalysis[];
}

interface ReplayActConfig {
  label: string;
  numRooms: number;
  getCounts: (rng: StsRng, ascension: number) => MapPointTypeCounts;
}

interface MapCoord {
  col: number;
  row: number;
}

export type ReplayActMapVariant = ActMapVariant;

interface MapPointTypeCounts {
  numElites: number;
  numShops: number;
  numUnknowns: number;
  numRests: number;
  pointTypesThatIgnoreRules: Set<ReplayMapPointType>;
}

class DotNetRandom {
  private static readonly MBIG = 2147483647;
  private static readonly MSEED = 161803398;

  private readonly seedArray = new Array<number>(56).fill(0);
  private inext = 0;
  private inextp = 21;

  constructor(seed: number) {
    const subtraction = seed === INT_MIN ? INT_MAX : Math.abs(seed);
    let mj = DotNetRandom.MSEED - subtraction;
    if (mj < 0) mj += DotNetRandom.MBIG;
    this.seedArray[55] = mj;

    let mk = 1;
    for (let i = 1; i < 55; i++) {
      const ii = (21 * i) % 55;
      this.seedArray[ii] = mk;
      mk = mj - mk;
      if (mk < 0) mk += DotNetRandom.MBIG;
      mj = this.seedArray[ii];
    }

    for (let k = 1; k < 5; k++) {
      for (let i = 1; i < 56; i++) {
        this.seedArray[i] -= this.seedArray[1 + ((i + 30) % 55)];
        if (this.seedArray[i] < 0) {
          this.seedArray[i] += DotNetRandom.MBIG;
        }
      }
    }
  }

  next(): number {
    return this.internalSample();
  }

  nextInt(maxExclusive: number): number {
    if (maxExclusive <= 0) {
      throw new RangeError("maxExclusive must be positive");
    }
    return Math.floor(this.sample() * maxExclusive);
  }

  nextRange(minInclusive: number, maxExclusive: number): number {
    if (minInclusive >= maxExclusive) {
      throw new RangeError("minInclusive must be lower than maxExclusive");
    }
    const range = maxExclusive - minInclusive;
    return Math.floor(this.sample() * range) + minInclusive;
  }

  nextDouble(): number {
    return this.sample();
  }

  private sample(): number {
    return this.internalSample() * (1 / DotNetRandom.MBIG);
  }

  private internalSample(): number {
    let locINext = this.inext + 1;
    if (locINext >= 56) locINext = 1;
    let locINextp = this.inextp + 1;
    if (locINextp >= 56) locINextp = 1;

    let retVal = this.seedArray[locINext] - this.seedArray[locINextp];
    if (retVal === DotNetRandom.MBIG) retVal--;
    if (retVal < 0) retVal += DotNetRandom.MBIG;

    this.seedArray[locINext] = retVal;
    this.inext = locINext;
    this.inextp = locINextp;

    return retVal;
  }
}

class StsRng {
  readonly seed: number;
  private readonly random: DotNetRandom;

  constructor(seed: number, name?: string) {
    this.seed = name ? addUint32(seed, toUint32(getDeterministicHashCode(name))) : seed >>> 0;
    this.random = new DotNetRandom(toInt32(this.seed));
  }

  nextInt(maxExclusive = INT_MAX): number {
    return this.random.nextInt(maxExclusive);
  }

  nextIntRange(minInclusive: number, maxExclusive: number): number {
    return this.random.nextRange(minInclusive, maxExclusive);
  }

  nextDouble(): number {
    return this.random.nextDouble();
  }

  nextBool(): boolean {
    return this.random.nextInt(2) === 0;
  }

  nextGaussianInt(mean: number, stdDev: number, min: number, max: number): number {
    let candidate = 0;
    do {
      const d = 1 - this.random.nextDouble();
      const n = 1 - this.random.nextDouble();
      const gaussian = Math.sqrt(-2 * Math.log(d)) * Math.sin(Math.PI * 2 * n);
      // C# Math.Round defaults to MidpointRounding.ToEven (banker's). JS
      // Math.round always rounds half away from zero. For exact-half values
      // these diverge: 6.5 → C# 6 vs JS 7. Use banker's to match.
      candidate = roundHalfToEven(mean + stdDev * gaussian);
    } while (candidate < min || candidate > max);
    return candidate;
  }
}

class MapNode {
  readonly id: string;
  readonly parents = new Set<MapNode>();
  readonly children = new Set<MapNode>();
  coord: MapCoord;
  type: ReplayMapPointType | "unassigned";
  canBeModified = true;

  constructor(col: number, row: number, type: ReplayMapPointType | "unassigned" = "unassigned") {
    this.coord = { col, row };
    this.type = type;
    this.id = keyOfCoord(this.coord);
  }

  addChild(child: MapNode) {
    this.children.add(child);
    child.parents.add(this);
  }

  removeChild(child: MapNode) {
    this.children.delete(child);
    child.parents.delete(this);
  }
}

type ActMapVariant = "standard" | "golden_path" | "spoils";

class GeneratedActMap {
  readonly grid: Array<Array<MapNode | null>>;
  readonly boss: MapNode;
  readonly start: MapNode;
  readonly secondBoss: MapNode | null;
  readonly startMapPoints = new Set<MapNode>();
  readonly shouldReplaceTreasureWithElites: boolean;
  readonly pointTypeCounts: MapPointTypeCounts;
  readonly actConfig: ReplayActConfig;
  readonly rng: StsRng;
  readonly variant: ActMapVariant;

  constructor(
    rng: StsRng,
    actConfig: ReplayActConfig,
    pointTypeCounts: MapPointTypeCounts,
    shouldReplaceTreasureWithElites: boolean,
    hasSecondBoss: boolean,
    variant: ActMapVariant = "standard",
    isMultiplayer = false,
  ) {
    // Game's ActModel.GetNumberOfRooms reduces room count by 1 in multiplayer
    // mode (ActModel.cs:175-183).
    const numRooms = actConfig.numRooms - (isMultiplayer ? 1 : 0);
    const gridHeight = numRooms + 1;
    this.grid = Array.from({ length: MAP_COLUMNS }, () => Array<MapNode | null>(gridHeight).fill(null));
    this.rng = rng;
    this.actConfig = actConfig;
    this.pointTypeCounts = pointTypeCounts;
    this.shouldReplaceTreasureWithElites = shouldReplaceTreasureWithElites;
    this.variant = variant;
    this.start = new MapNode(Math.floor(MAP_COLUMNS / 2), 0, "ancient");
    this.boss = new MapNode(Math.floor(MAP_COLUMNS / 2), gridHeight, "boss");
    this.secondBoss = hasSecondBoss ? new MapNode(Math.floor(MAP_COLUMNS / 2), gridHeight + 1, "boss") : null;

    if (variant === "golden_path") {
      buildGoldenPathGrid(this);
    } else if (variant === "spoils") {
      // Spoils ports MegaCrit.Sts2.Core.Map.SpoilsActMap (v0.104). No
      // centerGrid/spreadAdjacent/straighten — that's Standard-only.
      buildSpoilsHourglassGrid(this);
      this.assignSpoilsPointTypes();
      pruneAndRepair(this);
    } else {
      this.generateMap();
      this.assignPointTypes();
      pruneAndRepair(this);
      centerGrid(this.grid);
      spreadAdjacentMapPoints(this.grid);
      straightenPaths(this.grid);
    }
  }

  get rowCount(): number {
    return this.grid[0].length;
  }

  getOrCreatePoint(col: number, row: number): MapNode {
    const existing = this.grid[col][row];
    if (existing) return existing;
    const node = new MapNode(col, row);
    this.grid[col][row] = node;
    return node;
  }

  getPoint(coord: MapCoord): MapNode | null {
    if (sameCoord(coord, this.start.coord)) return this.start;
    if (sameCoord(coord, this.boss.coord)) return this.boss;
    if (this.secondBoss && sameCoord(coord, this.secondBoss.coord)) return this.secondBoss;
    if (coord.col < 0 || coord.col >= MAP_COLUMNS) return null;
    if (coord.row < 0 || coord.row >= this.rowCount) return null;
    return this.grid[coord.col][coord.row];
  }

  hasPoint(coord: MapCoord): boolean {
    return this.getPoint(coord) !== null;
  }

  isInMap(node: MapNode): boolean {
    if (node.type === "ancient" || node.type === "boss") {
      return true;
    }
    const found = this.getPoint(node.coord);
    return found === node;
  }

  getAllMapPoints(): MapNode[] {
    const points: MapNode[] = [];
    for (let col = 0; col < MAP_COLUMNS; col++) {
      for (let row = 0; row < this.rowCount; row++) {
        const point = this.grid[col][row];
        if (point) points.push(point);
      }
    }
    return points;
  }

  getPointsInRow(row: number): MapNode[] {
    if (row < 0 || row >= this.rowCount) return [];
    const points: MapNode[] = [];
    for (let col = 0; col < MAP_COLUMNS; col++) {
      const point = this.grid[col][row];
      if (point) points.push(point);
    }
    return points;
  }

  private generateMap() {
    for (let i = 0; i < MAP_COLUMNS; i++) {
      let startPoint = this.getOrCreatePoint(this.rng.nextIntRange(0, MAP_COLUMNS), 1);
      if (i === 1) {
        while (this.startMapPoints.has(startPoint)) {
          startPoint = this.getOrCreatePoint(this.rng.nextIntRange(0, MAP_COLUMNS), 1);
        }
      }
      this.startMapPoints.add(startPoint);
      this.pathGenerate(startPoint);
    }

    for (const point of this.getPointsInRow(this.rowCount - 1)) {
      point.addChild(this.boss);
    }
    if (this.secondBoss) {
      this.boss.addChild(this.secondBoss);
    }
    for (const point of this.getPointsInRow(1)) {
      this.start.addChild(point);
    }
  }

  private pathGenerate(startingPoint: MapNode) {
    let point = startingPoint;
    while (point.coord.row < this.rowCount - 1) {
      const next = this.generateNextCoord(point);
      const child = this.getOrCreatePoint(next.col, next.row);
      point.addChild(child);
      point = child;
    }
  }

  private generateNextCoord(current: MapNode): MapCoord {
    const col = current.coord.col;
    const left = Math.max(0, col - 1);
    const right = Math.min(col + 1, MAP_COLUMNS - 1);
    const directions = stableShuffle([-1, 0, 1], compareNumbers, this.rng);

    for (const direction of directions) {
      const targetCol = direction === -1 ? left : direction === 0 ? col : right;
      if (!this.hasInvalidCrossover(current, targetCol)) {
        return { col: targetCol, row: current.coord.row + 1 };
      }
    }

    throw new Error(`Cannot find next node for seed ${this.rng.seed}`);
  }

  private hasInvalidCrossover(current: MapNode, targetCol: number): boolean {
    const direction = targetCol - current.coord.col;
    if (direction === 0 || direction === MAP_COLUMNS) {
      return false;
    }
    const sibling = this.grid[targetCol][current.coord.row];
    if (!sibling) return false;

    for (const child of sibling.children) {
      if (child.coord.col - sibling.coord.col === -direction) {
        return true;
      }
    }
    return false;
  }

  private assignPointTypes() {
    this.forEachInRow(this.rowCount - 1, (point) => {
      point.type = "rest_site";
      point.canBeModified = false;
    });

    this.forEachInRow(this.rowCount - 7, (point) => {
      point.type = this.shouldReplaceTreasureWithElites ? "elite" : "treasure";
      point.canBeModified = false;
    });

    this.forEachInRow(1, (point) => {
      point.type = "monster";
      point.canBeModified = false;
    });

    const queue: ReplayMapPointType[] = [];
    for (let i = 0; i < this.pointTypeCounts.numRests; i++) queue.push("rest_site");
    for (let i = 0; i < this.pointTypeCounts.numShops; i++) queue.push("shop");
    for (let i = 0; i < this.pointTypeCounts.numElites; i++) queue.push("elite");
    for (let i = 0; i < this.pointTypeCounts.numUnknowns; i++) queue.push("unknown");

    this.assignRemainingTypes(queue);

    for (const point of this.getAllMapPoints()) {
      if (point.type === "unassigned") {
        point.type = "monster";
      }
    }

    this.start.type = "ancient";
    this.boss.type = "boss";
    if (this.secondBoss) {
      this.secondBoss.type = "boss";
    }
  }

  private assignRemainingTypes(queue: ReplayMapPointType[]) {
    for (let i = 0; i < 3; i++) {
      if (queue.length === 0) break;
      const candidates = this.getAllMapPoints()
        .filter((point) => point.type === "unassigned")
        .sort(compareMapNodes);
      stableShuffle(candidates, compareMapNodes, this.rng);

      for (const point of candidates) {
        if (queue.length === 0) break;
        point.type = this.getNextValidPointType(queue, point);
      }
    }
  }

  private getNextValidPointType(queue: ReplayMapPointType[], point: MapNode): ReplayMapPointType | "unassigned" {
    const length = queue.length;
    for (let i = 0; i < length; i++) {
      const type = queue.shift();
      if (!type) break;
      if (this.pointTypeCounts.pointTypesThatIgnoreRules.has(type) || isValidPointType(this, type, point)) {
        return type;
      }
      queue.push(type);
    }
    return "unassigned";
  }

  private forEachInRow(row: number, callback: (point: MapNode) => void) {
    for (const point of this.getPointsInRow(row)) {
      callback(point);
    }
  }

  assignSpoilsPointTypes() {
    // Mirrors MegaCrit.Sts2.Core.Map.SpoilsActMap.AssignPointTypes.
    // Treasure row is already placed by buildSpoilsHourglassGrid, so don't
    // override it. Row 1 here is "Monster if Unassigned" (no canBeModified
    // flip), unlike Standard which locks row 1 to Monster unconditionally.
    this.forEachInRow(this.rowCount - 1, (point) => {
      point.type = "rest_site";
      point.canBeModified = false;
    });

    this.forEachInRow(1, (point) => {
      if (point.type === "unassigned") {
        point.type = "monster";
      }
    });

    const queue: ReplayMapPointType[] = [];
    for (let i = 0; i < this.pointTypeCounts.numRests; i++) queue.push("rest_site");
    for (let i = 0; i < this.pointTypeCounts.numShops; i++) queue.push("shop");
    for (let i = 0; i < this.pointTypeCounts.numElites; i++) queue.push("elite");
    for (let i = 0; i < this.pointTypeCounts.numUnknowns; i++) queue.push("unknown");

    this.assignRemainingTypes(queue);

    for (const point of this.getAllMapPoints()) {
      if (point.type === "unassigned") {
        point.type = "monster";
      }
    }

    this.start.type = "ancient";
    this.boss.type = "boss";
  }
}

const ACT_CONFIGS: Record<string, ReplayActConfig> = {
  "ACT.OVERGROWTH": {
    label: "과성장",
    numRooms: 15,
    getCounts: (rng, ascension) => {
      // Must consume RNG in this exact order to match StandardActMap.cs — rest first,
      // then unknown (Overgrowth.cs:127-129).
      const numRests = rng.nextGaussianInt(7, 1, 6, 7);
      const numUnknowns = standardRandomUnknownCount(rng);
      return {
        numElites: Math.round(5 * (ascension >= 1 ? 1.6 : 1)),
        numShops: 3,
        numUnknowns,
        numRests,
        pointTypesThatIgnoreRules: new Set(),
      };
    },
  },
  "ACT.UNDERDOCKS": {
    label: "지하 선착장",
    numRooms: 15,
    getCounts: (rng, ascension) => {
      const numRests = rng.nextGaussianInt(7, 1, 6, 7);
      const numUnknowns = standardRandomUnknownCount(rng);
      return {
        numElites: Math.round(5 * (ascension >= 1 ? 1.6 : 1)),
        numShops: 3,
        numUnknowns,
        numRests,
        pointTypesThatIgnoreRules: new Set(),
      };
    },
  },
  "ACT.HIVE": {
    label: "군락",
    numRooms: 14,
    getCounts: (rng, ascension) => {
      const numRests = rng.nextGaussianInt(6, 1, 6, 7);
      const numUnknowns = standardRandomUnknownCount(rng) - 1;
      return {
        numElites: Math.round(5 * (ascension >= 1 ? 1.6 : 1)),
        numShops: 3,
        numUnknowns,
        numRests,
        pointTypesThatIgnoreRules: new Set(),
      };
    },
  },
  "ACT.GLORY": {
    label: "영광",
    numRooms: 13,
    getCounts: (rng, ascension) => {
      const numRests = rng.nextIntRange(5, 7);
      const numUnknowns = standardRandomUnknownCount(rng) - 1;
      return {
        numElites: Math.round(5 * (ascension >= 1 ? 1.6 : 1)),
        numShops: 3,
        numUnknowns,
        numRests,
        pointTypesThatIgnoreRules: new Set(),
      };
    },
  },
};

export function parseReplayRun(raw: string): ReplayRun {
  const parsed = JSON.parse(raw) as Partial<ReplayRun>;

  if (typeof parsed.seed !== "string" || !Array.isArray(parsed.acts) || !Array.isArray(parsed.map_point_history)) {
    throw new Error("STS2 .run 형식이 아닙니다.");
  }

  return {
    seed: parsed.seed,
    build_id: typeof parsed.build_id === "string" ? parsed.build_id : "unknown",
    ascension: typeof parsed.ascension === "number" ? parsed.ascension : 0,
    game_mode: typeof parsed.game_mode === "string" ? parsed.game_mode : "standard",
    win: !!parsed.win,
    run_time: typeof parsed.run_time === "number" ? parsed.run_time : undefined,
    start_time: typeof parsed.start_time === "number" ? parsed.start_time : undefined,
    acts: parsed.acts.filter((act): act is string => typeof act === "string"),
    players: Array.isArray(parsed.players)
      ? parsed.players.map((player) => ({
          id: typeof player?.id === "number" ? player.id : 0,
          character: typeof player?.character === "string" ? player.character : "UNKNOWN",
          deck: Array.isArray(player?.deck)
            ? player.deck
                .filter((card): card is ReplayDeckCard => typeof card?.id === "string")
                .map((card) => ({
                  id: card.id,
                  floor_added_to_deck:
                    typeof card.floor_added_to_deck === "number" ? card.floor_added_to_deck : undefined,
                  current_upgrade_level:
                    typeof card.current_upgrade_level === "number" ? card.current_upgrade_level : undefined,
                }))
            : [],
          relics: Array.isArray(player?.relics)
            ? player.relics
                .filter((relic): relic is ReplayRelic => typeof relic?.id === "string")
                .map((relic) => {
                  const props = (relic as { props?: { ints?: { name?: string; value?: number }[]; int_arrays?: { name?: string; value?: number[] }[] } }).props;
                  const ints: Record<string, number> = {};
                  for (const item of props?.ints ?? []) {
                    if (typeof item?.name === "string" && typeof item.value === "number") {
                      ints[item.name] = item.value;
                    }
                  }
                  const intArrays: Record<string, number[]> = {};
                  for (const item of props?.int_arrays ?? []) {
                    if (typeof item?.name === "string" && Array.isArray(item.value)) {
                      intArrays[item.name] = item.value.filter(
                        (v): v is number => typeof v === "number",
                      );
                    }
                  }
                  return {
                    id: relic.id,
                    floor_added_to_deck:
                      typeof relic.floor_added_to_deck === "number" ? relic.floor_added_to_deck : undefined,
                    ints: Object.keys(ints).length > 0 ? ints : undefined,
                    intArrays: Object.keys(intArrays).length > 0 ? intArrays : undefined,
                  };
                })
            : [],
        }))
      : [],
    modifiers: Array.isArray(parsed.modifiers)
      ? parsed.modifiers
          .map((modifier) => {
            if (typeof modifier === "string") {
              return { id: modifier };
            }
            if (modifier && typeof modifier === "object") {
              const maybeId = "id" in modifier && typeof modifier.id === "string" ? modifier.id : undefined;
              const maybeName = "name" in modifier && typeof modifier.name === "string" ? modifier.name : undefined;
              return { id: maybeId, name: maybeName };
            }
            return { id: undefined };
          })
      : [],
    map_point_history: parsed.map_point_history.map((act) =>
      Array.isArray(act)
        ? act.map((entry) => {
            type RawCardChoice = { card?: { id?: string }; was_picked?: boolean };
            type RawSimpleChoice = { choice?: string; was_picked?: boolean };
            const rawEntry = entry as Partial<ReplayHistoryEntry> & {
              player_stats?: Array<{
                current_hp?: number;
                max_hp?: number;
                current_gold?: number;
                damage_taken?: number;
                hp_healed?: number;
                max_hp_gained?: number;
                max_hp_lost?: number;
                gold_gained?: number;
                gold_spent?: number;
                gold_lost?: number;
                gold_stolen?: number;
                cards_gained?: { id?: string }[];
                cards_lost?: { id?: string }[];
                cards_removed?: { id?: string }[];
                upgraded_cards?: string[];
                cards_enchanted?: Array<{
                  card?: { id?: string; enchantment?: { id?: string; amount?: number } };
                  enchantment?: string;
                }>;
                card_choices?: RawCardChoice[];
                relic_choices?: RawSimpleChoice[];
                potion_choices?: RawSimpleChoice[];
              }>;
            };
            const firstStats = Array.isArray(rawEntry.player_stats) ? rawEntry.player_stats[0] : undefined;
            const pickStat = (
              flat: number | undefined,
              nested: number | undefined,
            ): number | undefined => {
              if (typeof flat === "number") return flat;
              if (typeof nested === "number") return nested;
              return undefined;
            };
            const pickCards = (list: { id?: string }[] | undefined) =>
              Array.isArray(list)
                ? list
                    .filter((c): c is { id: string } => typeof c?.id === "string")
                    .map((c) => ({ id: c.id }))
                : undefined;
            const pickCardChoices = (list: RawCardChoice[] | undefined): ReplayChoice[] | undefined =>
              Array.isArray(list)
                ? list
                    .filter((c): c is { card: { id: string }; was_picked?: boolean } =>
                      typeof c?.card?.id === "string",
                    )
                    .map((c) => ({ id: c.card.id, picked: !!c.was_picked }))
                : undefined;
            const pickSimpleChoices = (list: RawSimpleChoice[] | undefined): ReplayChoice[] | undefined =>
              Array.isArray(list)
                ? list
                    .filter((c): c is { choice: string; was_picked?: boolean } =>
                      typeof c?.choice === "string",
                    )
                    .map((c) => ({ id: c.choice, picked: !!c.was_picked }))
                : undefined;
            const pickUpgradedCards = (list: string[] | undefined): string[] | undefined =>
              Array.isArray(list) ? list.filter((id): id is string => typeof id === "string") : undefined;
            const pickEnchantments = (
              list:
                | Array<{
                    card?: { id?: string; enchantment?: { id?: string; amount?: number } };
                    enchantment?: string;
                  }>
                | undefined,
            ): ReplayEnchantment[] | undefined =>
              Array.isArray(list)
                ? list.flatMap((e): ReplayEnchantment[] => {
                    const cardId = e?.card?.id;
                    const enchantmentId = e?.card?.enchantment?.id ?? e?.enchantment;
                    if (typeof cardId !== "string" || typeof enchantmentId !== "string") return [];
                    const entry: ReplayEnchantment = { cardId, enchantmentId };
                    if (typeof e?.card?.enchantment?.amount === "number") {
                      entry.amount = e.card.enchantment.amount;
                    }
                    return [entry];
                  })
                : undefined;
            return {
              map_point_type:
                typeof rawEntry.map_point_type === "string" ? rawEntry.map_point_type : "unknown",
              rooms: Array.isArray(rawEntry.rooms)
                ? rawEntry.rooms
                    .map((room) => ({
                      room_type: typeof room?.room_type === "string" ? room.room_type : "unknown",
                      model_id: typeof room?.model_id === "string" ? room.model_id : null,
                      turns_taken: typeof room?.turns_taken === "number" ? room.turns_taken : 0,
                    }))
                : [],
              current_hp: pickStat(rawEntry.current_hp, firstStats?.current_hp),
              max_hp: pickStat(rawEntry.max_hp, firstStats?.max_hp),
              current_gold: pickStat(rawEntry.current_gold, firstStats?.current_gold),
              damage_taken: firstStats?.damage_taken,
              hp_healed: firstStats?.hp_healed,
              max_hp_gained: firstStats?.max_hp_gained,
              max_hp_lost: firstStats?.max_hp_lost,
              gold_gained: firstStats?.gold_gained,
              gold_spent: firstStats?.gold_spent,
              gold_lost: firstStats?.gold_lost,
              gold_stolen: firstStats?.gold_stolen,
              cards_gained: pickCards(firstStats?.cards_gained),
              cards_lost: pickCards(firstStats?.cards_lost),
              cards_removed: pickCards(firstStats?.cards_removed),
              upgraded_cards: pickUpgradedCards(firstStats?.upgraded_cards),
              cards_enchanted: pickEnchantments(firstStats?.cards_enchanted),
              card_choices: pickCardChoices(firstStats?.card_choices),
              relic_choices: pickSimpleChoices(firstStats?.relic_choices),
              potion_choices: pickSimpleChoices(firstStats?.potion_choices),
            };
          })
        : [],
    ),
  };
}

const WINGED_BOOTS_MAX_CHARGES = 3;

// Per-act encounter/event/ancient pools — extracted directly from
// `MegaCrit.Sts2.Core.Models.Acts.{Overgrowth,Hive,Glory,Underdocks}` in
// declaration order. This is the input to `simulateActsUpFront` which mirrors
// `RunManager.GenerateRooms` to deterministically pick the boss for each act
// (so we can render the right boss icon even when the player didn't reach it).
//
// Order matters: GrabBag indexing iterates entries in insertion order to
// resolve the `r * totalWeight` cursor; if we sort or de-duplicate we'd drift
// off the C# RNG path.
interface ActEncounterPool {
  weaks: readonly string[];
  regulars: readonly string[];
  elites: readonly string[];
  bosses: readonly string[];
  events: readonly string[];
  ancients: readonly string[];
  numWeaks: number;
  numRooms: number;
}

const ACT_POOLS: Record<string, ActEncounterPool> = {
  "ACT.OVERGROWTH": {
    weaks: ["FUZZY_WURM_CRAWLER_WEAK", "NIBBITS_WEAK", "SHRINKER_BEETLE_WEAK", "SLIMES_WEAK"],
    regulars: [
      "CUBEX_CONSTRUCT_NORMAL",
      "FLYCONID_NORMAL",
      "FOGMOG_NORMAL",
      "INKLETS_NORMAL",
      "MAWLER_NORMAL",
      "NIBBITS_NORMAL",
      "OVERGROWTH_CRAWLERS",
      "RUBY_RAIDERS_NORMAL",
      "SLIMES_NORMAL",
      "SLITHERING_STRANGLER_NORMAL",
      "SNAPPING_JAXFRUIT_NORMAL",
      "VINE_SHAMBLER_NORMAL",
    ],
    elites: ["BYGONE_EFFIGY_ELITE", "BYRDONIS_ELITE", "PHROG_PARASITE_ELITE"],
    bosses: ["CEREMONIAL_BEAST_BOSS", "THE_KIN_BOSS", "VANTOM_BOSS"],
    events: [
      "AROMA_OF_CHAOS",
      "BYRDONIS_NEST",
      "DENSE_VEGETATION",
      "JUNGLE_MAZE_ADVENTURE",
      "LUMINOUS_CHOIR",
      "MORPHIC_GROVE",
      "SAPPHIRE_SEED",
      "SUNKEN_STATUE",
      "TABLET_OF_TRUTH",
      "UNREST_SITE",
      "WELLSPRING",
      "WHISPERING_HOLLOW",
      "WOOD_CARVINGS",
    ],
    ancients: ["NEOW"],
    numWeaks: 3,
    numRooms: 15,
  },
  "ACT.UNDERDOCKS": {
    weaks: ["CORPSE_SLUGS_WEAK", "SEAPUNK_WEAK", "SLUDGE_SPINNER_WEAK", "TOADPOLES_WEAK"],
    regulars: [
      "CORPSE_SLUGS_NORMAL",
      "CULTISTS_NORMAL",
      "FOSSIL_STALKER_NORMAL",
      "GREMLIN_MERC_NORMAL",
      "HAUNTED_SHIP_NORMAL",
      "LIVING_FOG_NORMAL",
      "PUNCH_CONSTRUCT_NORMAL",
      "SEAPUNK_NORMAL",
      "SEWER_CLAM_NORMAL",
      "TWO_TAILED_RATS_NORMAL",
    ],
    elites: ["PHANTASMAL_GARDENERS_ELITE", "SKULKING_COLONY_ELITE", "TERROR_EEL_ELITE"],
    bosses: ["LAGAVULIN_MATRIARCH_BOSS", "SOUL_FYSH_BOSS", "WATERFALL_GIANT_BOSS"],
    events: [
      "ABYSSAL_BATHS",
      "DROWNING_BEACON",
      "ENDLESS_CONVEYOR",
      "PUNCH_OFF",
      "SPIRALING_WHIRLPOOL",
      "SUNKEN_STATUE",
      "SUNKEN_TREASURY",
      "DOORS_OF_LIGHT_AND_DARK",
      "TRASH_HEAP",
      "WATERLOGGED_SCRIPTORIUM",
    ],
    ancients: ["NEOW"],
    numWeaks: 3,
    numRooms: 15,
  },
  "ACT.HIVE": {
    weaks: ["BOWLBUGS_WEAK", "EXOSKELETONS_WEAK", "THIEVING_HOPPER_WEAK", "TUNNELER_WEAK"],
    regulars: [
      "BOWLBUGS_NORMAL",
      "CHOMPERS_NORMAL",
      "EXOSKELETONS_NORMAL",
      "HUNTER_KILLER_NORMAL",
      "LOUSE_PROGENITOR_NORMAL",
      "MYTES_NORMAL",
      "OVICOPTER_NORMAL",
      "SLUMBERING_BEETLE_NORMAL",
      "SPINY_TOAD_NORMAL",
      "THE_OBSCURA_NORMAL",
    ],
    elites: ["DECIMILLIPEDE_ELITE", "ENTOMANCER_ELITE", "INFESTED_PRISMS_ELITE"],
    bosses: ["KAISER_CRAB_BOSS", "KNOWLEDGE_DEMON_BOSS", "THE_INSATIABLE_BOSS"],
    events: [
      "AMALGAMATOR",
      "BUGSLAYER",
      "COLORFUL_PHILOSOPHERS",
      "COLOSSAL_FLOWER",
      "FIELD_OF_MAN_SIZED_HOLES",
      "INFESTED_AUTOMATON",
      "LOST_WISP",
      "SPIRIT_GRAFTER",
      "THE_LANTERN_KEY",
      "ZEN_WEAVER",
    ],
    ancients: ["OROBAS", "PAEL", "TEZCATARA"],
    numWeaks: 2,
    numRooms: 14,
  },
  "ACT.GLORY": {
    weaks: ["DEVOTED_SCULPTOR_WEAK", "SCROLLS_OF_BITING_WEAK", "TURRET_OPERATOR_WEAK"],
    regulars: [
      "AXEBOTS_NORMAL",
      "CONSTRUCT_MENAGERIE_NORMAL",
      "FABRICATOR_NORMAL",
      "FROG_KNIGHT_NORMAL",
      "GLOBE_HEAD_NORMAL",
      "OWL_MAGISTRATE_NORMAL",
      "SCROLLS_OF_BITING_NORMAL",
      "SLIMED_BERSERKER_NORMAL",
      "THE_LOST_AND_FORGOTTEN_NORMAL",
    ],
    elites: ["KNIGHTS_ELITE", "MECHA_KNIGHT_ELITE", "SOUL_NEXUS_ELITE"],
    bosses: ["DOORMAKER_BOSS", "QUEEN_BOSS", "TEST_SUBJECT_BOSS"],
    events: [
      "BATTLEWORN_DUMMY",
      "GRAVE_OF_THE_FORGOTTEN",
      "HUNGRY_FOR_MUSHROOMS",
      "REFLECTIONS",
      "ROUND_TEA_PARTY",
      "TRIAL",
      "TINKER_TIME",
    ],
    ancients: ["NONUPEIPE", "TANX", "VAKUU"],
    numWeaks: 2,
    numRooms: 13,
  },
};

// 18 shared events from `ModelDb.AllSharedEvents` — only the count matters
// for RNG advancement (UnstableShuffle on the concatenated events list), the
// actual contents don't affect boss/ancient picks downstream.
const SHARED_EVENTS_COUNT = 18;

// `UnlockState.SharedAncients` with DarvEpoch revealed. We assume "all
// unlocked" — see `replay_next_session.md` for caveat on first-runs.
const SHARED_ANCIENTS: readonly string[] = ["DARV"];

// Tags drive `AddWithoutRepeatingTags`'s grab-bag predicate. Encounters
// missing from this map have no tags (default in C#: `Array.Empty`).
const ENCOUNTER_TAGS: Record<string, readonly string[]> = {
  BOWLBUGS_NORMAL: ["Workers"],
  BOWLBUGS_WEAK: ["Workers"],
  CHOMPERS_NORMAL: ["Chomper"],
  CORPSE_SLUGS_NORMAL: ["Slugs"],
  CORPSE_SLUGS_WEAK: ["Slugs"],
  EXOSKELETONS_NORMAL: ["Exoskeletons"],
  EXOSKELETONS_WEAK: ["Exoskeletons"],
  FLYCONID_NORMAL: ["Mushroom", "Slimes"],
  FUZZY_WURM_CRAWLER_WEAK: ["Crawler"],
  KNIGHTS_ELITE: ["Knights"],
  NIBBITS_WEAK: ["Nibbit"],
  OVERGROWTH_CRAWLERS: ["Shrinker", "Crawler"],
  SCROLLS_OF_BITING_NORMAL: ["Scrolls"],
  SCROLLS_OF_BITING_WEAK: ["Scrolls"],
  SEAPUNK_NORMAL: ["Seapunk"],
  SEAPUNK_WEAK: ["Seapunk"],
  SHRINKER_BEETLE_WEAK: ["Shrinker"],
  SLIMES_NORMAL: ["Slimes"],
  SLIMES_WEAK: ["Slimes"],
  SLUMBERING_BEETLE_NORMAL: ["Workers"],
  SNAPPING_JAXFRUIT_NORMAL: ["Mushroom"],
  THIEVING_HOPPER_WEAK: ["Thieves"],
  TUNNELER_WEAK: ["Burrower"],
};

// Backwards-compat: existing UI consumers still read `bossPool` to render the
// "?" placeholder when boss couldn't be resolved. Built from ACT_POOLS.
export const ACT_BOSS_POOL: Record<string, string[]> = Object.fromEntries(
  Object.entries(ACT_POOLS).map(([id, pool]) => [id, [...pool.bosses]]),
);

// Relic rarity sequences for `RunManager.InitializeNewRun` Populate calls.
// `SharedRelicGrabBag.Populate(sharedRelics, upFront)` runs first, then each
// player's `PopulateRelicGrabBagIfNecessary` populates a *filtered* pool of
// shared+character relics. Both partition by rarity (insertion order) and
// shuffle each bucket — that's the RNG drift we have to mirror before
// `GenerateRooms` so per-act boss picks line up.
//
// Rarities are encoded as the declaration-order list of relic rarities in
// each pool. The sim only needs the rarity sequence (not relic identity)
// because GrabBag shuffling consumes RNG proportional to bucket size.
type RelicRarity = "Common" | "Uncommon" | "Rare" | "Shop" | "Event" | "Ancient" | "Starter";

const SHARED_RELIC_RARITIES: readonly RelicRarity[] = [
  "Uncommon", "Common", "Common", "Rare", "Common", "Common", "Rare", "Rare",
  "Shop", "Common", "Common", "Uncommon", "Shop", "Common", "Shop", "Uncommon",
  "Rare", "Shop", "Common", "Rare", "Shop", "Rare", "Shop", "Shop",
  "Shop", "Uncommon", "Common", "Event", "Rare", "Rare", "Rare", "Shop",
  "Rare", "Shop", "Common", "Uncommon", "Common", "Uncommon", "Rare", "Rare",
  "Uncommon", "Common", "Shop", "Rare", "Uncommon", "Common", "Uncommon", "Shop",
  "Shop", "Uncommon", "Rare", "Ancient", "Uncommon", "Rare", "Common", "Rare",
  "Shop", "Uncommon", "Uncommon", "Shop", "Rare", "Rare", "Shop", "Uncommon",
  "Common", "Rare", "Uncommon", "Uncommon", "Shop", "Uncommon", "Uncommon", "Uncommon",
  "Uncommon", "Common", "Uncommon", "Uncommon", "Uncommon", "Rare", "Common", "Rare",
  "Shop", "Rare", "Rare", "Common", "Common", "Uncommon", "Shop", "Uncommon",
  "Shop", "Shop", "Rare", "Rare", "Shop", "Uncommon", "Rare", "Uncommon",
  "Common", "Common", "Rare", "Shop", "Rare", "Uncommon", "Shop", "Rare",
  "Rare", "Uncommon", "Rare", "Rare", "Common", "Uncommon", "Common", "Ancient",
  "Rare", "Common", "Common", "Rare", "Rare", "Shop",
];

// Per-character relic pool rarities (8 each). See `*RelicPool.cs`.
const CHARACTER_POOL_RARITIES: Record<string, readonly RelicRarity[]> = {
  IRONCLAD: ["Shop", "Starter", "Rare", "Rare", "Uncommon", "Common", "Rare", "Uncommon"],
  SILENT: ["Rare", "Shop", "Rare", "Starter", "Common", "Uncommon", "Rare", "Uncommon"],
  DEFECT: ["Starter", "Common", "Rare", "Uncommon", "Rare", "Rare", "Shop", "Uncommon"],
  NECROBINDER: ["Rare", "Common", "Uncommon", "Rare", "Starter", "Uncommon", "Rare", "Shop"],
  REGENT: ["Starter", "Common", "Uncommon", "Rare", "Rare", "Rare", "Uncommon", "Shop"],
};

// `RelicGrabBag._rarities` — filter for player.PopulateRelicGrabBag.
const PLAYER_GRAB_BAG_RARITIES = new Set<RelicRarity>(["Common", "Uncommon", "Rare", "Shop"]);

// Mirror `RelicGrabBag.Populate(IEnumerable<RelicModel>, Rng)`:
//   1. Bucket relics by rarity (`Dictionary<Rarity, List<Model>>`,
//      insertion-ordered).
//   2. Iterate `_deques.Values` and `UnstableShuffle` each list.
// We don't care about relic identity — only the rarity sequence drives
// bucket size and rarity insertion order, which fully determines RNG
// consumption.
function consumePopulate(
  rarities: readonly RelicRarity[],
  rng: StsRng,
  filter?: ReadonlySet<RelicRarity>,
): void {
  const buckets = new Map<RelicRarity, number>();
  for (const r of rarities) {
    if (filter && !filter.has(r)) continue;
    buckets.set(r, (buckets.get(r) ?? 0) + 1);
  }
  for (const count of buckets.values()) {
    const dummy = new Array<number>(count).fill(0);
    unstableShuffle(dummy, rng);
  }
}

function characterIdFromKey(key: string): string {
  return (key.split(".").pop() ?? key).toUpperCase();
}

// C# `GrabBag<T>` port — weighted random pop with optional predicate filter.
// Critical: the iteration order of `entries` is insertion order, since
// `GrabIndex` walks entries to resolve `r * totalWeight`. Reordering changes
// which entry maps to which RNG roll and breaks bit-exact reproduction.
class GrabBag<T> {
  private readonly entries: { item: T; weight: number }[] = [];
  private totalWeight = 0;

  add(item: T, weight: number) {
    this.entries.push({ item, weight });
    this.totalWeight += weight;
  }

  any(): boolean {
    return this.entries.length > 0;
  }

  grabAndRemove(rng: StsRng, predicate?: (item: T) => boolean): T | null {
    const idx = this.grabIndex(rng, predicate);
    if (idx < 0) return null;
    const { item, weight } = this.entries[idx];
    this.totalWeight -= weight;
    this.entries.splice(idx, 1);
    return item;
  }

  private grabIndex(rng: StsRng, predicate?: (item: T) => boolean): number {
    if (predicate && !this.entries.some((e) => predicate(e.item))) {
      return -1;
    }
    let idx: number;
    do {
      idx = this.grabIndexNoPredicate(rng);
    } while (predicate && idx >= 0 && !predicate(this.entries[idx].item));
    return idx;
  }

  private grabIndexNoPredicate(rng: StsRng): number {
    const r = rng.nextDouble() * this.totalWeight;
    let acc = 0;
    for (let i = 0; i < this.entries.length; i++) {
      acc += this.entries[i].weight;
      if (r < acc) return i;
    }
    return -1;
  }
}

function sharesTagsWith(a: string, b: string | null): boolean {
  if (b == null) return false;
  const ta = ENCOUNTER_TAGS[a];
  const tb = ENCOUNTER_TAGS[b];
  if (!ta || !tb) return false;
  for (const tag of ta) {
    if (tb.includes(tag)) return true;
  }
  return false;
}

// Mirrors `ActModel.AddWithoutRepeatingTags` — pick with the no-repeat-tags
// predicate first; fall back to unconstrained pick if the bag has no
// passing entries.
function addWithoutRepeatingTags(
  encounters: string[],
  bag: GrabBag<string>,
  rng: StsRng,
): void {
  const last = encounters.length > 0 ? encounters[encounters.length - 1] : null;
  let picked = bag.grabAndRemove(
    rng,
    (e) => !sharesTagsWith(e, last) && e !== last,
  );
  if (picked == null) {
    picked = bag.grabAndRemove(rng);
  }
  if (picked != null) {
    encounters.push(picked);
  }
}

export interface ActsSimulationResult {
  // First-boss prediction per act, keyed by `actIndex`. `null` when the act
  // is unknown (e.g. mod content) so callers can fall back to history.
  firstBossByAct: (string | null)[];
  // The DoubleBoss (A10) second boss for the final act. `null` when DoubleBoss
  // is not active or the final act is unknown.
  secondBossOfFinalAct: string | null;
}

// Replays `RunManager.{InitializeNewRun,GenerateRooms}` UpFront RNG flow
// exactly — relic-pool populates (one shared, one per player), shared-ancient
// shuffle/deal, then per-act events shuffle + weak/regular/elite grab bags
// + `NextItem(AllBossEncounters)` for boss and `NextItem(ancientPool)` for
// ancient. Returns the predicted first/second boss per act.
//
// Assumes "all unlocked" (epochs revealed) — for fresh accounts, the relic
// pool filtering and events filtering would change list sizes and skew RNG
// offsets, yielding wrong predictions.
export function simulateActsUpFront(
  seed: string,
  acts: readonly string[],
  isMultiplayer: boolean,
  hasDoubleBoss: boolean,
  characterIds: readonly string[],
): ActsSimulationResult {
  const numericSeed = toUint32(getDeterministicHashCode(seed));
  const upFront = new StsRng(numericSeed, "up_front");

  // === RunManager.InitializeNewRun ===
  // 1. SharedRelicGrabBag.Populate(unlocked shared relics, upFront)
  consumePopulate(SHARED_RELIC_RARITIES, upFront);
  // 2. Each player.PopulateRelicGrabBagIfNecessary(upFront) — filtered to
  //    Common/Uncommon/Rare/Shop on the shared+character pool.
  for (const charKey of characterIds) {
    const charId = characterIdFromKey(charKey);
    const charRarities = CHARACTER_POOL_RARITIES[charId];
    if (!charRarities) continue;
    const combined = [...SHARED_RELIC_RARITIES, ...charRarities];
    consumePopulate(combined, upFront, PLAYER_GRAB_BAG_RARITIES);
  }

  // === RunManager.GenerateRooms ===
  // SharedAncients shuffle, then per-non-first-act subset deal.
  const sharedDeck = [...SHARED_ANCIENTS];
  unstableShuffle(sharedDeck, upFront);
  const sharedSubsets: string[][] = acts.map(() => []);
  let remainingShared = sharedDeck;
  for (let i = 1; i < acts.length; i++) {
    const count = upFront.nextInt(remainingShared.length + 1);
    const taken = remainingShared.slice(0, count);
    sharedSubsets[i] = taken;
    remainingShared = remainingShared.slice(count);
  }

  const firstBossByAct: (string | null)[] = [];
  let lastFirstBoss: string | null = null;
  let lastActPool: ActEncounterPool | null = null;

  for (let i = 0; i < acts.length; i++) {
    const actId = normalizeActId(acts[i] ?? "");
    const pool = ACT_POOLS[actId];
    if (!pool) {
      firstBossByAct.push(null);
      lastFirstBoss = null;
      lastActPool = null;
      continue;
    }
    const numRooms = pool.numRooms - (isMultiplayer ? 1 : 0);

    // 1. Events list shuffle. The contents of the shuffled list do not feed
    //    boss/ancient picks; only RNG advancement matters. We use a dummy
    //    array of the right length so the consumed NextInt sequence matches.
    const events = new Array<number>(pool.events.length + SHARED_EVENTS_COUNT).fill(0);
    unstableShuffle(events, upFront);

    // 2. Weak grab bag — `NumberOfWeakEncounters` iterations.
    const normalEncounters: string[] = [];
    const weakBag = new GrabBag<string>();
    for (let n = 0; n < pool.numWeaks; n++) {
      if (!weakBag.any()) {
        for (const w of pool.weaks) weakBag.add(w, 1);
      }
      addWithoutRepeatingTags(normalEncounters, weakBag, upFront);
    }

    // 3. Regular grab bag — `numRooms - NumberOfWeakEncounters` iterations.
    const regularBag = new GrabBag<string>();
    for (let n = pool.numWeaks; n < numRooms; n++) {
      if (!regularBag.any()) {
        for (const r of pool.regulars) regularBag.add(r, 1);
      }
      addWithoutRepeatingTags(normalEncounters, regularBag, upFront);
    }

    // 4. Elite grab bag — fixed 15 iterations regardless of map size.
    const eliteEncounters: string[] = [];
    const eliteBag = new GrabBag<string>();
    for (let n = 0; n < 15; n++) {
      if (!eliteBag.any()) {
        for (const e of pool.elites) eliteBag.add(e, 1);
      }
      addWithoutRepeatingTags(eliteEncounters, eliteBag, upFront);
    }

    // 5. Boss = NextItem(AllBossEncounters).
    const bossIdx = upFront.nextIntRange(0, pool.bosses.length);
    const boss = pool.bosses[bossIdx];
    firstBossByAct.push(boss);

    // 6. Ancient = NextItem(unlockedAncients ∪ sharedSubset). We don't
    //    surface the ancient pick yet but must consume the RNG call so the
    //    next act's offset stays aligned.
    const ancientPool = [...pool.ancients, ...sharedSubsets[i]];
    if (ancientPool.length > 0) {
      upFront.nextIntRange(0, ancientPool.length);
    }

    lastFirstBoss = boss;
    lastActPool = pool;
  }

  // 7. DoubleBoss A10 — secondBoss = NextItem(AllBossEncounters except first).
  let secondBossOfFinalAct: string | null = null;
  if (hasDoubleBoss && lastFirstBoss && lastActPool) {
    const candidates = lastActPool.bosses.filter((b) => b !== lastFirstBoss);
    if (candidates.length > 0) {
      const idx = upFront.nextIntRange(0, candidates.length);
      secondBossOfFinalAct = candidates[idx];
    }
  }

  return { firstBossByAct, secondBossOfFinalAct };
}

export function analyzeReplayRun(run: ReplayRun): ReplayAnalysis {
  const warnings = collectWarnings(run);
  const modifierIds = new Set(
    run.modifiers
      .map((modifier) => normalizeIdentifier(modifier.id ?? modifier.name))
      .filter(Boolean),
  );
  const acts: ReplayActAnalysis[] = [];
  let baseFloor = 1;

  const player = run.players[0];
  const hasFlightModifier = modifierIds.has("FLIGHT");
  const bootsRelic = player?.relics.find(
    (relic) => normalizeIdentifier(relic.id) === "WINGED_BOOTS",
  );
  const bootsAcquiredFloor = bootsRelic?.floor_added_to_deck ?? Infinity;
  let totalBootsFlightsUsed = 0;

  const isMultiplayer = run.players.length > 1;
  const hasDoubleBoss = run.ascension >= 10;
  const characterIds = run.players.map((p) => p.character);
  const simulation = simulateActsUpFront(
    run.seed,
    run.acts,
    isMultiplayer,
    hasDoubleBoss,
    characterIds,
  );
  const finalActIndex = run.acts.length - 1;

  for (let actIndex = 0; actIndex < run.map_point_history.length; actIndex++) {
    const actId = normalizeActId(run.acts[actIndex] ?? "");
    const config = ACT_CONFIGS[actId];
    const history = run.map_point_history[actIndex] ?? [];
    const normalizedHistoryTypes = history.map((entry) => normalizePointType(entry.map_point_type));

    if (!config || normalizedHistoryTypes.some((type) => type === null)) {
      baseFloor += history.length;
      continue;
    }

    const historyTypes = normalizedHistoryTypes.filter(
      (type): type is ReplayMapPointType => type !== null,
    );
    const actEndFloor = baseFloor + history.length - 1;
    const map = buildGeneratedMap(
      run,
      actId,
      actIndex,
      modifierIds,
      baseFloor,
      actEndFloor,
    );
    const bootsActiveInAct =
      bootsAcquiredFloor <= actEndFloor && totalBootsFlightsUsed < WINGED_BOOTS_MAX_CHARGES;
    const flightBudget = hasFlightModifier
      ? Number.POSITIVE_INFINITY
      : bootsActiveInAct
        ? WINGED_BOOTS_MAX_CHARGES - totalBootsFlightsUsed
        : 0;
    const match = findMatchingPathsWithFlight(map, historyTypes, flightBudget);
    if (!hasFlightModifier && match.pathCount > 0) {
      totalBootsFlightsUsed += match.flightStepsUsed;
    }
    const furCoatMarkerNodeIds = collectFurCoatMarkerNodeIds(run, actIndex, map);
    const spoilsMarkerNodeId = collectSpoilsMarkerNodeId(map);
    const flightArrivalNodeIds: string[] = [];
    if (match.pathCount === 1) {
      for (const stepIndex of match.flightStepIndices) {
        const nodeId = match.nodeCandidates[stepIndex]?.[0];
        if (nodeId) flightArrivalNodeIds.push(nodeId);
      }
    }
    acts.push({
      actIndex,
      actId,
      actLabel: config.label,
      baseFloor,
      history,
      historyTypes,
      nodes: toReplayNodes(map),
      edges: toReplayEdges(map),
      candidateNodeIdsByStep: match.nodeCandidates,
      candidateEdgeIdsByStep: match.edgeCandidates,
      matchedPathCount: match.pathCount,
      matchedPathCountCapped: match.capped,
      exactReplay: match.pathCount === 1,
      rowCount: map.secondBoss ? map.rowCount + 2 : map.rowCount + 1,
      mapVariant: map.variant,
      flightStepIndices: match.flightStepIndices,
      flightStepsUsed: match.flightStepsUsed,
      furCoatMarkerNodeIds,
      spoilsMarkerNodeId,
      flightArrivalNodeIds,
      bossPool: ACT_BOSS_POOL[actId] ?? [],
      predictedFirstBoss: simulation.firstBossByAct[actIndex] ?? null,
      predictedSecondBoss:
        actIndex === finalActIndex ? simulation.secondBossOfFinalAct : null,
    });
    baseFloor += history.length;
  }

  return { run, warnings, acts };
}

function collectWarnings(run: ReplayRun): string[] {
  const warnings: string[] = [];
  const modifierIds = new Set(
    run.modifiers
      .map((modifier) => normalizeIdentifier(modifier.id ?? modifier.name))
      .filter(Boolean),
  );
  const deckIds = new Set(
    run.players.flatMap((player) => player.deck.map((card) => normalizeIdentifier(card.id)).filter(Boolean)),
  );
  const relicIds = new Set(
    run.players.flatMap((player) => player.relics.map((relic) => normalizeIdentifier(relic.id)).filter(Boolean)),
  );

  if (modifierIds.has("FLIGHT")) {
    warnings.push("비행 모디파이어는 경로 제약을 바꾸므로 exact replay를 보장할 수 없습니다.");
  }
  if (relicIds.has("WINGED_BOOTS")) {
    warnings.push("날개 부츠(Winged Boots)의 Flight 경로 우회 규칙은 아직 반영되지 않았습니다.");
  }
  if (deckIds.has("SPOILS_MAP")) {
    warnings.push("보물지도(Spoils Map) 감지 — 해당 카드 획득 이후 막은 Spoils hourglass 맵으로 생성됩니다.");
  }
  if (relicIds.has("GOLDEN_COMPASS")) {
    warnings.push("황금 나침반(Golden Compass) 감지 — 획득 이후 막은 Golden Path(외길)로 생성됩니다.");
  }
  if (!run.acts.every((act) => ACT_CONFIGS[normalizeActId(act)])) {
    warnings.push("지원하지 않는 막 구성이 포함되어 일부 시드 맵은 재생성하지 못했습니다.");
  }
  return warnings;
}

function buildGeneratedMap(
  run: ReplayRun,
  actId: string,
  actIndex: number,
  modifierIds: Set<string>,
  actStartFloor: number,
  actEndFloor: number,
): GeneratedActMap {
  const config = ACT_CONFIGS[actId];
  const seed = toUint32(getDeterministicHashCode(run.seed));
  const hasSecondBoss = actIndex === run.acts.length - 1 && run.ascension >= 10;
  const isMultiplayer = run.players.length > 1;
  const variant = chooseActMapVariant(run, actStartFloor, actEndFloor);

  if (variant === "golden_path") {
    // Golden Path uses no RNG; pass a dummy one. Seed is deterministic regardless.
    const rng = new StsRng(seed, `act_${actIndex + 1}_golden_path`);
    const counts = config.getCounts(rng, run.ascension);
    return new GeneratedActMap(rng, config, counts, false, hasSecondBoss, "golden_path", isMultiplayer);
  }

  if (variant === "spoils") {
    const rng = new StsRng(seed, "spoils_map");
    const counts = config.getCounts(rng, run.ascension);
    return new GeneratedActMap(rng, config, counts, false, hasSecondBoss, "spoils", isMultiplayer);
  }

  const baseRng = new StsRng(seed, `act_${actIndex + 1}_map`);
  const baseCounts = config.getCounts(baseRng, run.ascension);
  let map = new GeneratedActMap(baseRng, config, baseCounts, false, hasSecondBoss, "standard", isMultiplayer);

  if (modifierIds.has("BIG_GAME_HUNTER")) {
    const eliteCount = map.getAllMapPoints().filter((point) => point.type === "elite").length;
    const overrideRng = new StsRng(seed, `act_${actIndex + 1}_map`);
    const overrideCounts: MapPointTypeCounts = {
      numElites: Math.round(eliteCount * 2.5),
      numShops: baseCounts.numShops,
      numUnknowns: baseCounts.numUnknowns,
      numRests: baseCounts.numRests,
      pointTypesThatIgnoreRules: new Set<ReplayMapPointType>(["elite"]),
    };
    map = new GeneratedActMap(overrideRng, config, overrideCounts, false, hasSecondBoss, "standard", isMultiplayer);
  }

  return map;
}

function chooseActMapVariant(
  run: ReplayRun,
  actStartFloor: number,
  actEndFloor: number,
): ActMapVariant {
  const player = run.players[0];
  if (!player) return "standard";
  const idOf = (value?: string) => (value ?? "").toUpperCase();
  // Golden Compass: granted at Tezcatara's ancient option (start of an act).
  // Game's GoldenCompass.AfterObtained calls RunManager.GenerateMap immediately,
  // so the act's map is regenerated as Golden Path the moment the relic is
  // picked. We detect it via the relic's floor_added_to_deck falling inside
  // this act's floor range.
  const compassInThisAct = player.relics.some((relic) => {
    const id = idOf(relic.id);
    if (!id.endsWith("GOLDEN_COMPASS")) return false;
    const added = relic.floor_added_to_deck ?? 0;
    return added >= actStartFloor && added <= actEndFloor;
  });
  if (compassInThisAct) return "golden_path";
  // Spoils Map card: SpoilsMap.ModifyGeneratedMap fires when actIndex == 1
  // AND the card is in the deck pile at map-generation time (= start of act
  // 2). The card auto-removes on quest completion (mid-act 2), so the FINAL
  // deck snapshot in `.run` may not contain it. We must reconstruct deck
  // membership at the start of this act by replaying cards_gained/cards_lost
  // history.
  if (cardWasInDeckAtFloor(run, "SPOILS_MAP", actStartFloor)) {
    return "spoils";
  }
  return "standard";
}

function collectFurCoatMarkerNodeIds(
  run: ReplayRun,
  actIndex: number,
  map: GeneratedActMap,
): string[] {
  // Game's FurCoat saves marked coordinates in props.int_arrays
  // (FurCoatCoordCols / FurCoatCoordRows). The relic also stores
  // FurCoatActIndex — markers only show in the act it was obtained.
  const player = run.players[0];
  if (!player) return [];
  const relic = player.relics.find(
    (r) => normalizeIdentifier(r.id) === "FUR_COAT",
  );
  if (!relic) return [];
  const furActIndex = relic.ints?.FurCoatActIndex;
  if (typeof furActIndex !== "number" || furActIndex !== actIndex) return [];
  const cols = relic.intArrays?.FurCoatCoordCols ?? [];
  const rows = relic.intArrays?.FurCoatCoordRows ?? [];
  const result: string[] = [];
  for (let i = 0; i < Math.min(cols.length, rows.length); i++) {
    const node = map.getPoint({ col: cols[i], row: rows[i] });
    if (node) result.push(node.id);
  }
  return result;
}

function collectSpoilsMarkerNodeId(map: GeneratedActMap): string | null {
  // SpoilsMap.ModifyGeneratedMapLate picks the first treasure node in
  // GetAllMapPoints iteration order. SpoilsActMap collapses to a single
  // treasure at (midCol, treasureRow).
  if (map.variant !== "spoils") return null;
  for (const point of map.getAllMapPoints()) {
    if (point.type === "treasure") return point.id;
  }
  return null;
}

function cardWasInDeckAtFloor(
  run: ReplayRun,
  cardSuffix: string,
  targetFloor: number,
): boolean {
  // Check player.deck for cards still present at the end of run that were
  // added before targetFloor — those are definitely in deck at targetFloor.
  const player = run.players[0];
  if (!player) return false;
  const matches = (id: string | undefined) =>
    typeof id === "string" && id.toUpperCase().endsWith(cardSuffix);
  for (const card of player.deck) {
    if (matches(card.id) && (card.floor_added_to_deck ?? 0) < targetFloor) {
      return true;
    }
  }
  // Also walk history for cards gained then later removed — those won't be
  // in the final deck snapshot. If gained < targetFloor and removal (if any)
  // is at floor >= targetFloor, the card was in deck at start of targetFloor.
  let floor = 1;
  let lastGainedFloor: number | null = null;
  let lastRemovedFloor: number | null = null;
  for (const act of run.map_point_history) {
    for (const entry of act) {
      for (const card of entry.cards_gained ?? []) {
        if (matches(card.id)) lastGainedFloor = floor;
      }
      for (const card of entry.cards_lost ?? []) {
        if (matches(card.id)) lastRemovedFloor = floor;
      }
      for (const card of entry.cards_removed ?? []) {
        if (matches(card.id)) lastRemovedFloor = floor;
      }
      floor++;
    }
  }
  if (lastGainedFloor === null) return false;
  if (lastGainedFloor >= targetFloor) return false;
  if (lastRemovedFloor !== null && lastRemovedFloor < targetFloor) return false;
  return true;
}

function buildGoldenPathGrid(map: GeneratedActMap) {
  // Per MegaCrit.Sts2.Core.Map.GoldenPathActMap — fixed 16-room straight line at col=3
  const defaultTypes: ReplayMapPointType[] = [
    "monster",
    "unknown",
    "monster",
    "rest_site",
    "monster",
    "rest_site",
    "unknown",
    "treasure",
    "unknown",
    "treasure",
    "unknown",
    "shop",
    "elite",
    "rest_site",
    "elite",
    "rest_site",
  ];
  const col = Math.floor(MAP_COLUMNS / 2);
  // Grid rows: 0 (ancient) through defaultTypes.length (last normal). Boss sits
  // at row = gridHeight (just past the grid), matching GeneratedActMap's layout
  // where boss.coord.row == grid.length (getRowCount).
  const gridHeight = defaultTypes.length + 1;
  for (let c = 0; c < MAP_COLUMNS; c++) {
    map.grid[c] = Array<MapNode | null>(gridHeight).fill(null);
  }
  map.boss.coord = { col, row: gridHeight };
  if (map.secondBoss) {
    map.secondBoss.coord = { col, row: gridHeight + 1 };
  }
  let prev: MapNode | null = null;
  for (let i = 0; i < defaultTypes.length; i++) {
    const row = i + 1;
    const node = new MapNode(col, row, defaultTypes[i]);
    node.canBeModified = false;
    map.grid[col][row] = node;
    if (prev) {
      prev.addChild(node);
    }
    prev = node;
  }
  const firstNormal = map.grid[col][1]!;
  map.startMapPoints.add(firstNormal);
  map.start.addChild(firstNormal);
  if (prev) prev.addChild(map.boss);
  if (map.secondBoss) map.boss.addChild(map.secondBoss);
}

function buildSpoilsHourglassGrid(map: GeneratedActMap) {
  // Ports MegaCrit.Sts2.Core.Map.SpoilsActMap.GenerateHourglassMap (v0.104).
  // Unlike Standard, Spoils uses hourglass-specific GenerateNextCoord that
  // funnels paths toward the center treasure column as they approach
  // _treasureRow, then fans back out.
  const treasureRow = map.rowCount - 7;
  if (treasureRow <= 0 || treasureRow >= map.rowCount) {
    throw new Error("Treasure row is out of bounds for SpoilsActMap");
  }
  const midCol = Math.floor(MAP_COLUMNS / 2);

  for (let i = 0; i < MAP_COLUMNS; i++) {
    let startPoint = map.getOrCreatePoint(map.rng.nextIntRange(0, MAP_COLUMNS), 1);
    if (i === 1) {
      while (map.startMapPoints.has(startPoint)) {
        startPoint = map.getOrCreatePoint(map.rng.nextIntRange(0, MAP_COLUMNS), 1);
      }
    }
    map.startMapPoints.add(startPoint);
    spoilsPathGenerate(map, startPoint, treasureRow);
  }

  const treasureNode = map.getOrCreatePoint(midCol, treasureRow);
  treasureNode.type = "treasure";
  treasureNode.canBeModified = false;

  for (const stray of map.getPointsInRow(treasureRow).slice()) {
    if (stray !== treasureNode) {
      redirectToTreasure(map, stray, treasureNode);
    }
  }

  // ConnectRowToBoss
  for (let col = 0; col < MAP_COLUMNS; col++) {
    const point = map.grid[col][map.rowCount - 1];
    if (point && !point.children.has(map.boss)) {
      point.addChild(map.boss);
    }
  }

  // ConnectRowToStart
  for (let col = 0; col < MAP_COLUMNS; col++) {
    const point = map.grid[col][1];
    if (point && !map.start.children.has(point)) {
      map.start.addChild(point);
    }
  }
}

function spoilsPathGenerate(map: GeneratedActMap, start: MapNode, treasureRow: number) {
  let point = start;
  while (point.coord.row < map.rowCount - 1) {
    const next = spoilsGenerateNextCoord(map, point, treasureRow);
    const child = map.getOrCreatePoint(next.col, next.row);
    point.addChild(child);
    point = child;
  }
}

function spoilsGenerateNextCoord(
  map: GeneratedActMap,
  current: MapNode,
  treasureRow: number,
): MapCoord {
  const row = current.coord.row + 1;
  const { minCol, maxCol } = spoilsAllowedColumnsForRow(map, row, treasureRow);
  const centerCol = Math.floor(MAP_COLUMNS / 2);
  const distanceToTreasure = treasureRow - current.coord.row;

  let directions: number[];
  if (distanceToTreasure > 3) {
    directions = stableShuffle([-1, 0, 1], compareNumbers, map.rng);
  } else if (distanceToTreasure > 0) {
    directions = spoilsBuildCenteredPriorityList(current.coord.col, centerCol);
  } else {
    directions = stableShuffle([-1, 0, 1], compareNumbers, map.rng);
  }

  for (const direction of directions) {
    const nextColumn = spoilsGetNextColumn(current.coord.col, direction);
    if (
      nextColumn < minCol ||
      nextColumn > maxCol ||
      spoilsHasInvalidCrossover(map, current, nextColumn)
    ) {
      continue;
    }
    const point = map.getPoint({ col: nextColumn, row });
    const pointOk =
      point === null || point.parents.has(current) || point.parents.size < 3;
    const currentOk =
      current === map.start ||
      current.children.size < 3 ||
      (point !== null && current.children.has(point));
    if (pointOk && currentOk) {
      if (Math.abs(nextColumn - current.coord.col) > 1) {
        throw new Error(
          `Invalid step from (${current.coord.col}, ${current.coord.row}) to column ${nextColumn}`,
        );
      }
      return { col: nextColumn, row };
    }
  }

  // Fallback — bias toward center within the allowed band, clamped to one step.
  let fallback = Math.max(minCol, Math.min(maxCol, centerCol));
  if (Math.abs(fallback - current.coord.col) > 1) {
    const step = Math.sign(fallback - current.coord.col);
    fallback = Math.max(minCol, Math.min(maxCol, current.coord.col + step));
  }
  if (spoilsHasInvalidCrossover(map, current, fallback)) {
    fallback = Math.max(minCol, Math.min(maxCol, current.coord.col));
  }
  if (Math.abs(fallback - current.coord.col) > 1) {
    throw new Error(
      `Fallback step from (${current.coord.col}, ${current.coord.row}) to column ${fallback} exceeds adjacency`,
    );
  }
  return { col: fallback, row };
}

function spoilsAllowedColumnsForRow(
  map: GeneratedActMap,
  row: number,
  treasureRow: number,
): { minCol: number; maxCol: number } {
  const center = Math.floor(MAP_COLUMNS / 2);
  const distanceToTreasure = Math.abs(row - treasureRow);
  const distanceToTop = map.rowCount - 1 - row;
  const topLimit = Math.min(center, Math.max(0, distanceToTop) + 1);
  const band = Math.min(center, Math.min(distanceToTreasure, topLimit));
  return {
    minCol: Math.max(0, center - band),
    maxCol: Math.min(MAP_COLUMNS - 1, center + band),
  };
}

function spoilsBuildCenteredPriorityList(currentCol: number, centerCol: number): number[] {
  const list: number[] = [];
  const toward = Math.sign(centerCol - currentCol);
  if (toward !== 0) list.push(toward);
  list.push(0);
  const away = -toward;
  if (toward !== 0) list.push(away);
  if (!list.includes(-1)) list.push(-1);
  if (!list.includes(1)) list.push(1);
  return list;
}

function spoilsGetNextColumn(currentCol: number, direction: number): number {
  if (direction === -1) return Math.max(0, currentCol - 1);
  if (direction === 1) return Math.min(MAP_COLUMNS - 1, currentCol + 1);
  return currentCol;
}

function spoilsHasInvalidCrossover(
  map: GeneratedActMap,
  current: MapNode,
  targetCol: number,
): boolean {
  const delta = targetCol - current.coord.col;
  if (delta === 0) return false;
  const sibling = map.grid[targetCol][current.coord.row];
  if (!sibling) return false;
  for (const child of sibling.children) {
    if (child.coord.col - sibling.coord.col === -delta) {
      return true;
    }
  }
  return false;
}

function redirectToTreasure(map: GeneratedActMap, stray: MapNode, treasure: MapNode) {
  for (const parent of Array.from(stray.parents)) {
    parent.removeChild(stray);
    parent.addChild(treasure);
  }
  for (const child of Array.from(stray.children)) {
    stray.removeChild(child);
    treasure.addChild(child);
  }
  map.grid[stray.coord.col][stray.coord.row] = null;
}

interface MatchedPath {
  nodeIds: string[];
  flightDepths: number[];
}

interface MatchResult {
  pathCount: number;
  capped: boolean;
  nodeCandidates: string[][];
  edgeCandidates: string[][];
  flightStepIndices: number[];
  flightStepsUsed: number;
}

function findMatchingPaths(
  map: GeneratedActMap,
  historyTypes: ReplayMapPointType[],
  flightBudget: number,
): { paths: MatchedPath[]; capped: boolean } {
  const paths: MatchedPath[] = [];
  const nodeIds: string[] = [];
  const flightDepths: number[] = [];

  const walk = (
    node: MapNode,
    depth: number,
    chargesUsed: number,
    arrivedByFlight: boolean,
  ) => {
    if (paths.length >= MATCH_CAP) return;
    if (node.type !== historyTypes[depth]) return;

    nodeIds.push(node.id);
    if (arrivedByFlight) flightDepths.push(depth);

    if (depth === historyTypes.length - 1) {
      paths.push({ nodeIds: [...nodeIds], flightDepths: [...flightDepths] });
    } else {
      const nextRow = node.coord.row + 1;
      const childIds = new Set<string>();
      const children = Array.from(node.children).sort(compareMapNodes);

      for (const child of children) {
        childIds.add(child.id);
        walk(child, depth + 1, chargesUsed, false);
        if (paths.length >= MATCH_CAP) break;
      }

      if (
        chargesUsed < flightBudget &&
        nextRow < map.rowCount &&
        nextRow > 0 &&
        paths.length < MATCH_CAP
      ) {
        const flightCandidates: MapNode[] = [];
        for (let col = 0; col < MAP_COLUMNS; col++) {
          const candidate = map.grid[col][nextRow];
          if (candidate && !childIds.has(candidate.id)) {
            flightCandidates.push(candidate);
          }
        }
        flightCandidates.sort(compareMapNodes);
        for (const candidate of flightCandidates) {
          walk(candidate, depth + 1, chargesUsed + 1, true);
          if (paths.length >= MATCH_CAP) break;
        }
      }
    }

    nodeIds.pop();
    if (arrivedByFlight) flightDepths.pop();
  };

  walk(map.start, 0, 0, false);

  return { paths, capped: paths.length >= MATCH_CAP };
}

function findMatchingPathsWithFlight(
  map: GeneratedActMap,
  historyTypes: ReplayMapPointType[],
  maxFlightBudget: number,
): MatchResult {
  // Try the lowest flight budget that yields any match. This finds the path
  // with the minimum number of off-edge jumps — closest to what the player
  // actually did, since extra phantom flights always introduce ambiguity.
  const ceiling = Number.isFinite(maxFlightBudget) ? maxFlightBudget : 6;
  let result: { paths: MatchedPath[]; capped: boolean } = { paths: [], capped: false };
  let usedBudget = 0;
  for (let budget = 0; budget <= ceiling; budget++) {
    const attempt = findMatchingPaths(map, historyTypes, budget);
    if (attempt.paths.length > 0) {
      result = attempt;
      usedBudget = budget;
      break;
    }
  }

  // Tie-breaker 1: among paths with the same flight count, prefer ones that
  // defer flight as late as possible. Players don't fly when a normal edge
  // would do, so later flights are more plausible than earlier ones.
  // Compare paths by their flight-depth list sorted descending; the
  // lexicographically largest list wins (latest flight, then second-latest,
  // etc.).
  if (result.paths.length > 1) {
    const ranked = result.paths.map((path) => ({
      path,
      key: [...path.flightDepths].sort((a, b) => b - a),
    }));
    const compareKeys = (a: number[], b: number[]) => {
      const len = Math.max(a.length, b.length);
      for (let i = 0; i < len; i++) {
        const av = a[i] ?? -1;
        const bv = b[i] ?? -1;
        if (av !== bv) return bv - av;
      }
      return 0;
    };
    ranked.sort((a, b) => compareKeys(a.key, b.key));
    const bestKey = ranked[0].key;
    const filtered = ranked
      .filter((entry) => compareKeys(entry.key, bestKey) === 0)
      .map((entry) => entry.path);
    result = { paths: filtered, capped: result.capped };
  }

  // Tie-breaker 2: if the flight tie-breaker still leaves multiple paths
  // (genuine data ambiguity — e.g. short act-3-die runs where two disjoint
  // branches share the same type sequence), arbitrarily pick the
  // lexicographically smallest one by node IDs. Deterministic and stable
  // across renders; the user explicitly opted into "just pick one".
  if (result.paths.length > 1) {
    const sorted = [...result.paths].sort((a, b) =>
      a.nodeIds.join("|").localeCompare(b.nodeIds.join("|")),
    );
    result = { paths: [sorted[0]], capped: result.capped };
  }

  const nodeCandidates = Array.from({ length: historyTypes.length }, () => new Set<string>());
  const edgeCandidates = Array.from({ length: historyTypes.length }, () => new Set<string>());
  for (const match of result.paths) {
    match.nodeIds.forEach((nodeId, index) => {
      nodeCandidates[index].add(nodeId);
      if (index > 0) {
        edgeCandidates[index].add(`${match.nodeIds[index - 1]}->${nodeId}`);
      }
    });
  }

  const flightStepIndices =
    result.paths.length === 1 ? [...result.paths[0].flightDepths] : [];

  return {
    pathCount: result.paths.length,
    capped: result.capped,
    nodeCandidates: nodeCandidates.map((set) => Array.from(set).sort()),
    edgeCandidates: edgeCandidates.map((set) => Array.from(set).sort()),
    flightStepIndices,
    flightStepsUsed: usedBudget,
  };
}

function toReplayNodes(map: GeneratedActMap): ReplayMapNode[] {
  const nodes = [
    map.start,
    ...map.getAllMapPoints(),
    map.boss,
    ...(map.secondBoss ? [map.secondBoss] : []),
  ];

  return dedupeNodes(nodes)
    .sort(compareMapNodes)
    .map((node) => ({
      id: node.id,
      col: node.coord.col,
      row: node.coord.row,
      type: node.type === "unassigned" ? "monster" : node.type,
    }));
}

function toReplayEdges(map: GeneratedActMap): ReplayMapEdge[] {
  const edges: ReplayMapEdge[] = [];
  const nodes = [
    map.start,
    ...map.getAllMapPoints(),
    map.boss,
    ...(map.secondBoss ? [map.secondBoss] : []),
  ];

  for (const node of dedupeNodes(nodes)) {
    for (const child of Array.from(node.children).sort(compareMapNodes)) {
      edges.push({
        id: `${node.id}->${child.id}`,
        from: node.id,
        to: child.id,
      });
    }
  }

  return edges.sort((a, b) => a.id.localeCompare(b.id));
}

function pruneAndRepair(map: GeneratedActMap) {
  for (let i = 0; i < 3; i++) {
    pruneDuplicateSegments(map);
    if (!repairPrunedPointTypes(map)) {
      break;
    }
  }
}

function repairPrunedPointTypes(map: GeneratedActMap): boolean {
  // Must NOT short-circuit — every type needs its RNG shuffle, even if earlier
  // ones changed the map. C# uses `|=` (non-short-circuiting) in
  // MapPathPruning.cs:27-31.
  const shopChanged = repairPointType(map, "shop", map.pointTypeCounts.numShops);
  const eliteChanged = repairPointType(map, "elite", map.pointTypeCounts.numElites);
  const restChanged = repairPointType(map, "rest_site", map.pointTypeCounts.numRests);
  const unknownChanged = repairPointType(map, "unknown", map.pointTypeCounts.numUnknowns);
  return shopChanged || eliteChanged || restChanged || unknownChanged;
}

function repairPointType(map: GeneratedActMap, type: ReplayMapPointType, targetCount: number): boolean {
  let remaining =
    targetCount - map.getAllMapPoints().filter((point) => point.type === type).length;
  if (remaining <= 0) {
    return false;
  }

  const candidates = map.getAllMapPoints()
    .filter((point) => point.type === "monster" && point.canBeModified)
    .sort(compareMapNodes);
  stableShuffle(candidates, compareMapNodes, map.rng);

  let changed = false;
  for (const point of candidates) {
    if (remaining === 0) break;
    if (isValidPointType(map, type, point)) {
      point.type = type;
      remaining--;
      changed = true;
    }
  }
  return changed;
}

function pruneDuplicateSegments(map: GeneratedActMap) {
  let iterations = 0;
  let matchingSegments = findMatchingSegments(map.start);

  while (prunePaths(map, matchingSegments)) {
    iterations++;
    if (iterations > 50) {
      throw new Error("Unable to prune duplicate map segments");
    }
    matchingSegments = findMatchingSegments(map.start);
  }
}

function findMatchingSegments(start: MapNode): MapNode[][][] {
  const allPaths = findAllPaths(start);
  const segments = new Map<string, MapNode[][]>();

  for (const path of allPaths) {
    addSegmentsToDictionary(path, segments);
  }

  // C# uses SortedDictionary<string, ...>(StringComparer.Ordinal) so the
  // duplicates are visited in ordinal-sorted key order. JS Map iterates in
  // insertion order, which would shuffle a different sequence of segments
  // (each unstableShuffle consumes RNG) and produce a different pruned map.
  const orderedKeys = Array.from(segments.keys()).sort();
  return orderedKeys
    .map((k) => segments.get(k)!)
    .filter((matches) => matches.length > 1);
}

function findAllPaths(current: MapNode): MapNode[][] {
  if (current.type === "boss") {
    return [[current]];
  }

  // Match C# MapPathPruning.FindAllPaths which iterates HashSet<MapPoint> in
  // INSERTION order (children added during pathGenerate). Sorting here would
  // re-order paths and shift overlap-detection winners in
  // addSegmentsToDictionary.
  const paths: MapNode[][] = [];
  for (const child of current.children) {
    for (const childPath of findAllPaths(child)) {
      paths.push([current, ...childPath]);
    }
  }
  return paths;
}

function addSegmentsToDictionary(path: MapNode[], segments: Map<string, MapNode[][]>) {
  for (let start = 0; start < path.length - 1; start++) {
    if (!isValidSegmentStart(path[start])) {
      continue;
    }
    for (let length = 2; length < path.length - start; length++) {
      const end = path[start + length];
      if (!isValidSegmentEnd(end)) {
        continue;
      }
      const segment = path.slice(start, start + length + 1);
      const key = generateSegmentKey(segment);
      const existing = segments.get(key) ?? [];
      if (!existing.some((item) => overlappingSegment(item, segment))) {
        existing.push(segment);
        segments.set(key, existing);
      }
    }
  }
}

function isValidSegmentStart(node: MapNode): boolean {
  if (node.children.size <= 1) {
    return node.coord.row === 0;
  }
  return true;
}

function isValidSegmentEnd(node: MapNode): boolean {
  return node.parents.size >= 2;
}

function generateSegmentKey(segment: MapNode[]): string {
  const start = segment[0];
  const end = segment[segment.length - 1];
  const prefix =
    start.coord.row === 0
      ? `${start.coord.row}-${end.coord.col},${end.coord.row}-`
      : `${start.coord.col},${start.coord.row}-${end.coord.col},${end.coord.row}-`;
  return prefix + segment.map((point) => pointTypeOrder(point.type === "unassigned" ? "monster" : point.type)).join(",");
}

function overlappingSegment(a: MapNode[], b: MapNode[]): boolean {
  if (a.length < 3 || b.length < 3) {
    return false;
  }
  for (let i = 1; i <= a.length - 2; i++) {
    if (a[i] === b[i]) {
      return true;
    }
  }
  return false;
}

function prunePaths(map: GeneratedActMap, matchingSegments: MapNode[][][]): boolean {
  for (const segmentMatches of matchingSegments) {
    unstableShuffle(segmentMatches, map.rng);
    if (pruneAllButLast(map, segmentMatches) !== 0) {
      return true;
    }
    if (breakParentChildRelationship(segmentMatches)) {
      return true;
    }
  }
  return false;
}

function pruneAllButLast(map: GeneratedActMap, matches: MapNode[][]): number {
  let pruned = 0;
  for (const match of matches) {
    if (pruned === matches.length - 1) {
      return pruned;
    }
    if (pruneSegment(map, match)) {
      pruned++;
    }
  }
  return pruned;
}

function pruneSegment(map: GeneratedActMap, segment: MapNode[]): boolean {
  let result = false;

  for (let i = 0; i < segment.length - 1; i++) {
    const point = segment[i];
    if (!map.isInMap(point)) {
      return true;
    }

    // C# MapPathPruning.cs:277 uses !IsRemoved(grid, n) — pure grid presence
    // check. That excludes start/boss (which sit outside the grid array even
    // when conceptually "in map"). Our previous use of map.isInMap would
    // include them and diverge for points whose only parent is the start
    // ancient with a single child.
    const hasSingleParentParent = Array.from(point.parents).some(
      (parent) => parent.children.size === 1 && pointInGrid(map, parent),
    );
    if (point.children.size > 1 || point.parents.size > 1 || hasSingleParentParent) {
      continue;
    }

    const remaining = segment.slice(i);
    const hasFutureBranch = remaining.some((node) => node.children.size > 1 && node.parents.size === 1);
    if (hasFutureBranch) {
      continue;
    }

    const segmentEnd = segment[segment.length - 1];
    if (segmentEnd.parents.size === 1) {
      return false;
    }

    // C# MapPathPruning.cs:288 uses segment.Contains(c) — the WHOLE segment,
    // not just the tail — when filtering children for the "outside single
    // parent" check.
    const hasOutsideSingleParent = Array.from(point.children)
      .filter((child) => !segment.includes(child))
      .some((child) => child.parents.size === 1);
    if (!hasOutsideSingleParent) {
      removePoint(map, point);
      result = true;
    }
  }

  return result;
}

function removePoint(map: GeneratedActMap, point: MapNode) {
  if (point.coord.row >= 0 && point.coord.row < map.rowCount) {
    map.grid[point.coord.col][point.coord.row] = null;
  }
  map.startMapPoints.delete(point);

  for (const child of Array.from(point.children)) {
    point.removeChild(child);
  }
  for (const parent of Array.from(point.parents)) {
    parent.removeChild(point);
  }
}

function breakParentChildRelationship(matches: MapNode[][]): boolean {
  for (const match of matches) {
    if (breakSegmentRelationship(match)) {
      return true;
    }
  }
  return false;
}

function breakSegmentRelationship(segment: MapNode[]): boolean {
  let changed = false;
  for (let i = 0; i < segment.length - 1; i++) {
    const point = segment[i];
    if (point.children.size < 2) {
      continue;
    }
    const next = segment[i + 1];
    if (next.parents.size !== 1) {
      point.removeChild(next);
      changed = true;
    }
  }
  return changed;
}

function isValidPointType(map: GeneratedActMap, type: ReplayMapPointType, point: MapNode): boolean {
  if (!isValidForUpper(map, type, point)) return false;
  if (!isValidForLower(type, point)) return false;
  if (!isValidWithParents(type, point)) return false;
  if (!isValidWithChildren(type, point)) return false;
  if (!isValidWithSiblings(type, point)) return false;
  return true;
}

function isValidForLower(type: ReplayMapPointType, point: MapNode): boolean {
  if (point.coord.row < 6) {
    return type !== "rest_site" && type !== "elite";
  }
  return true;
}

function isValidForUpper(map: GeneratedActMap, type: ReplayMapPointType, point: MapNode): boolean {
  if (point.coord.row >= map.rowCount - 3) {
    return type !== "rest_site";
  }
  return true;
}

function isValidWithParents(type: ReplayMapPointType, point: MapNode): boolean {
  if (!["elite", "rest_site", "treasure", "shop"].includes(type)) {
    return true;
  }
  return ![...point.parents, ...point.children].some((node) => node.type === type);
}

function isValidWithChildren(type: ReplayMapPointType, point: MapNode): boolean {
  if (!["elite", "rest_site", "treasure", "shop"].includes(type)) {
    return true;
  }
  return !Array.from(point.children).some((node) => node.type === type);
}

function isValidWithSiblings(type: ReplayMapPointType, point: MapNode): boolean {
  if (!["rest_site", "monster", "unknown", "elite", "shop"].includes(type)) {
    return true;
  }
  for (const parent of point.parents) {
    for (const sibling of parent.children) {
      if (sibling !== point && sibling.type === type) {
        return false;
      }
    }
  }
  return true;
}

function centerGrid(grid: Array<Array<MapNode | null>>) {
  const width = grid.length;
  const height = grid[0].length;
  const leftEmpty = isColumnEmpty(grid, 0) && isColumnEmpty(grid, 1);
  const rightEmpty = isColumnEmpty(grid, width - 1) && isColumnEmpty(grid, width - 2);
  const shift = leftEmpty && !rightEmpty ? -1 : !leftEmpty && rightEmpty ? 1 : 0;

  if (shift === 0) {
    return;
  }

  if (shift > 0) {
    for (let row = 0; row < height; row++) {
      for (let col = width - 1; col >= 0; col--) {
        const node = grid[col][row];
        grid[col][row] = null;
        const nextCol = col + shift;
        if (nextCol < width) {
          grid[nextCol][row] = node;
          if (node) node.coord.col = nextCol;
        }
      }
    }
    return;
  }

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const node = grid[col][row];
      grid[col][row] = null;
      const nextCol = col + shift;
      if (nextCol >= 0) {
        grid[nextCol][row] = node;
        if (node) node.coord.col = nextCol;
      }
    }
  }
}

function straightenPaths(grid: Array<Array<MapNode | null>>) {
  const width = grid.length;
  const height = grid[0].length;
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const node = grid[col][row];
      if (!node || node.parents.size !== 1 || node.children.size !== 1) {
        continue;
      }
      const parent = Array.from(node.parents)[0];
      const child = Array.from(node.children)[0];
      const leansLeft = node.coord.col < child.coord.col && node.coord.col < parent.coord.col;
      const leansRight = node.coord.col > child.coord.col && node.coord.col > parent.coord.col;

      if (leansLeft && col < width - 1 && !grid[col + 1][row]) {
        grid[col][row] = null;
        grid[col + 1][row] = node;
        node.coord.col = col + 1;
      }
      if (leansRight && col > 0 && !grid[col - 1][row]) {
        grid[col][row] = null;
        grid[col - 1][row] = node;
        node.coord.col = col - 1;
      }
    }
  }
}

function spreadAdjacentMapPoints(grid: Array<Array<MapNode | null>>) {
  const width = grid.length;
  const height = grid[0].length;

  for (let row = 0; row < height; row++) {
    const rowNodes: MapNode[] = [];
    for (let col = 0; col < width; col++) {
      const node = grid[col][row];
      if (node) rowNodes.push(node);
    }

    let changed = false;
    do {
      changed = false;
      for (const node of rowNodes) {
        const currentCol = node.coord.col;
        const allowed = getAllowedPositions(node, width);
        let bestCol = currentCol;
        let bestGap = computeGap(currentCol, rowNodes, node);

        for (const candidate of allowed) {
          const occupant = grid[candidate][row];
          if (candidate !== currentCol && (!occupant || occupant === node)) {
            const gap = computeGap(candidate, rowNodes, node);
            if (gap > bestGap) {
              bestCol = candidate;
              bestGap = gap;
            }
          }
        }

        if (bestCol !== currentCol) {
          grid[currentCol][row] = null;
          grid[bestCol][row] = node;
          node.coord.col = bestCol;
          changed = true;
        }
      }
    } while (changed);
  }
}

function getAllowedPositions(node: MapNode, totalColumns: number): Set<number> {
  const allowed = new Set<number>(Array.from({ length: totalColumns }, (_, index) => index));
  for (const parent of node.parents) {
    intersectSets(allowed, getNeighborAllowedPositions(parent.coord.col, totalColumns));
  }
  for (const child of node.children) {
    intersectSets(allowed, getNeighborAllowedPositions(child.coord.col, totalColumns));
  }
  return allowed;
}

function getNeighborAllowedPositions(column: number, totalColumns: number): Set<number> {
  const allowed = new Set<number>();
  for (let delta = -1; delta <= 1; delta++) {
    const next = column + delta;
    if (next >= 0 && next < totalColumns) {
      allowed.add(next);
    }
  }
  return allowed;
}

function computeGap(candidateCol: number, rowNodes: MapNode[], current: MapNode): number {
  let gap = Number.POSITIVE_INFINITY;
  for (const node of rowNodes) {
    if (node === current) continue;
    gap = Math.min(gap, Math.abs(candidateCol - node.coord.col));
  }
  return Number.isFinite(gap) ? gap : Number.POSITIVE_INFINITY;
}

function isColumnEmpty(grid: Array<Array<MapNode | null>>, col: number): boolean {
  return grid[col].every((node) => node === null);
}

function standardRandomUnknownCount(rng: StsRng): number {
  return rng.nextGaussianInt(12, 1, 10, 14);
}

function pointInGrid(map: GeneratedActMap, node: MapNode): boolean {
  // Mirrors C# !IsRemoved(grid, n) — purely checks the grid array, ignoring
  // the ancient/boss specialization that map.isInMap applies.
  const r = node.coord.row;
  const c = node.coord.col;
  if (r < 0 || r >= map.rowCount || c < 0 || c >= MAP_COLUMNS) return false;
  return map.grid[c][r] !== null;
}

function roundHalfToEven(value: number): number {
  const floored = Math.floor(value);
  const frac = value - floored;
  if (frac < 0.5) return floored;
  if (frac > 0.5) return floored + 1;
  // exactly 0.5 — round to even
  return floored % 2 === 0 ? floored : floored + 1;
}

function stableShuffle<T>(items: T[], compare: (a: T, b: T) => number, rng: StsRng): T[] {
  items.sort(compare);
  return unstableShuffle(items, rng);
}

function unstableShuffle<T>(items: T[], rng: StsRng): T[] {
  let index = items.length;
  while (index > 1) {
    index--;
    const swapIndex = rng.nextInt(index + 1);
    const value = items[index];
    items[index] = items[swapIndex];
    items[swapIndex] = value;
  }
  return items;
}

function dedupeNodes(nodes: MapNode[]): MapNode[] {
  const byId = new Map<string, MapNode>();
  for (const node of nodes) {
    byId.set(node.id, node);
  }
  return Array.from(byId.values());
}

function intersectSets(target: Set<number>, other: Set<number>) {
  for (const value of Array.from(target)) {
    if (!other.has(value)) {
      target.delete(value);
    }
  }
}

function pointTypeOrder(type: ReplayMapPointType): number {
  switch (type) {
    case "unknown":
      return 1;
    case "shop":
      return 2;
    case "treasure":
      return 3;
    case "rest_site":
      return 4;
    case "monster":
      return 5;
    case "elite":
      return 6;
    case "boss":
      return 7;
    case "ancient":
      return 8;
  }
}

function normalizePointType(raw: string): ReplayMapPointType | null {
  switch (raw) {
    case "ancient":
    case "monster":
    case "unknown":
    case "elite":
    case "rest_site":
    case "treasure":
    case "shop":
    case "boss":
      return raw;
    default:
      return null;
  }
}

function normalizeActId(raw: string): string {
  const upper = raw.toUpperCase();
  if (upper.startsWith("ACT.")) {
    return upper;
  }
  return `ACT.${upper}`;
}

function normalizeIdentifier(value: string | undefined): string {
  if (!value) return "";
  return value.toUpperCase().split(".").pop() ?? value.toUpperCase();
}

function keyOfCoord(coord: MapCoord): string {
  return `${coord.col}:${coord.row}`;
}

function sameCoord(a: MapCoord, b: MapCoord): boolean {
  return a.col === b.col && a.row === b.row;
}

function compareNumbers(a: number, b: number): number {
  return a - b;
}

function compareMapNodes(a: MapNode, b: MapNode): number {
  if (a.coord.col !== b.coord.col) {
    return a.coord.col - b.coord.col;
  }
  return a.coord.row - b.coord.row;
}

function addUint32(a: number, b: number): number {
  return (a + b) >>> 0;
}

function toUint32(value: number): number {
  return value >>> 0;
}

function toInt32(value: number): number {
  return value | 0;
}

function getDeterministicHashCode(str: string): number {
  let left = 352654597;
  let right = 352654597;

  for (let i = 0; i < str.length; i += 2) {
    left = (((left << 5) + left) ^ str.charCodeAt(i)) | 0;
    if (i === str.length - 1) {
      break;
    }
    right = (((right << 5) + right) ^ str.charCodeAt(i + 1)) | 0;
  }

  return (left + Math.imul(right, 1566083941)) | 0;
}
