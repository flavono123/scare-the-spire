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

export interface ReplayHistoryEntry {
  map_point_type: string;
  rooms: ReplayRoom[];
}

export interface ReplayDeckCard {
  id: string;
  floor_added_to_deck?: number;
}

export interface ReplayRelic {
  id: string;
  floor_added_to_deck?: number;
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

  nextBool(): boolean {
    return this.random.nextInt(2) === 0;
  }

  nextGaussianInt(mean: number, stdDev: number, min: number, max: number): number {
    let candidate = 0;
    do {
      const d = 1 - this.random.nextDouble();
      const n = 1 - this.random.nextDouble();
      const gaussian = Math.sqrt(-2 * Math.log(d)) * Math.sin(Math.PI * 2 * n);
      candidate = Math.round(mean + stdDev * gaussian);
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

  constructor(
    rng: StsRng,
    actConfig: ReplayActConfig,
    pointTypeCounts: MapPointTypeCounts,
    shouldReplaceTreasureWithElites: boolean,
    hasSecondBoss: boolean,
  ) {
    const gridHeight = actConfig.numRooms + 1;
    this.grid = Array.from({ length: MAP_COLUMNS }, () => Array<MapNode | null>(gridHeight).fill(null));
    this.rng = rng;
    this.actConfig = actConfig;
    this.pointTypeCounts = pointTypeCounts;
    this.shouldReplaceTreasureWithElites = shouldReplaceTreasureWithElites;
    this.start = new MapNode(Math.floor(MAP_COLUMNS / 2), 0, "ancient");
    this.boss = new MapNode(Math.floor(MAP_COLUMNS / 2), gridHeight, "boss");
    this.secondBoss = hasSecondBoss ? new MapNode(Math.floor(MAP_COLUMNS / 2), gridHeight + 1, "boss") : null;

    this.generateMap();
    this.assignPointTypes();
    pruneAndRepair(this);
    centerGrid(this.grid);
    spreadAdjacentMapPoints(this.grid);
    straightenPaths(this.grid);
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
}

const ACT_CONFIGS: Record<string, ReplayActConfig> = {
  "ACT.OVERGROWTH": {
    label: "초원지대",
    numRooms: 15,
    getCounts: (rng, ascension) => ({
      numElites: Math.round(5 * (ascension >= 1 ? 1.6 : 1)),
      numShops: 3,
      numUnknowns: standardRandomUnknownCount(rng),
      numRests: rng.nextGaussianInt(7, 1, 6, 7),
      pointTypesThatIgnoreRules: new Set(),
    }),
  },
  "ACT.UNDERDOCKS": {
    label: "언더독스",
    numRooms: 15,
    getCounts: (rng, ascension) => ({
      numElites: Math.round(5 * (ascension >= 1 ? 1.6 : 1)),
      numShops: 3,
      numUnknowns: standardRandomUnknownCount(rng),
      numRests: rng.nextGaussianInt(7, 1, 6, 7),
      pointTypesThatIgnoreRules: new Set(),
    }),
  },
  "ACT.HIVE": {
    label: "하이브",
    numRooms: 14,
    getCounts: (rng, ascension) => ({
      numElites: Math.round(5 * (ascension >= 1 ? 1.6 : 1)),
      numShops: 3,
      numUnknowns: standardRandomUnknownCount(rng) - 1,
      numRests: rng.nextGaussianInt(6, 1, 6, 7),
      pointTypesThatIgnoreRules: new Set(),
    }),
  },
  "ACT.GLORY": {
    label: "글로리",
    numRooms: 13,
    getCounts: (rng, ascension) => ({
      numElites: Math.round(5 * (ascension >= 1 ? 1.6 : 1)),
      numShops: 3,
      numUnknowns: standardRandomUnknownCount(rng) - 1,
      numRests: rng.nextIntRange(5, 7),
      pointTypesThatIgnoreRules: new Set(),
    }),
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
                }))
            : [],
          relics: Array.isArray(player?.relics)
            ? player.relics
                .filter((relic): relic is ReplayRelic => typeof relic?.id === "string")
                .map((relic) => ({
                  id: relic.id,
                  floor_added_to_deck:
                    typeof relic.floor_added_to_deck === "number" ? relic.floor_added_to_deck : undefined,
                }))
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
        ? act.map((entry) => ({
            map_point_type: typeof entry?.map_point_type === "string" ? entry.map_point_type : "unknown",
            rooms: Array.isArray(entry?.rooms)
              ? entry.rooms
                  .map((room) => ({
                    room_type: typeof room?.room_type === "string" ? room.room_type : "unknown",
                    model_id: typeof room?.model_id === "string" ? room.model_id : null,
                    turns_taken: typeof room?.turns_taken === "number" ? room.turns_taken : 0,
                  }))
              : [],
          }))
        : [],
    ),
  };
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

  for (let actIndex = 0; actIndex < run.map_point_history.length; actIndex++) {
    const actId = normalizeActId(run.acts[actIndex] ?? "");
    const config = ACT_CONFIGS[actId];
    const history = run.map_point_history[actIndex] ?? [];
    const historyTypes = history.map((entry) => normalizePointType(entry.map_point_type));

    if (!config || historyTypes.includes(null)) {
      baseFloor += history.length;
      continue;
    }

    const map = buildGeneratedMap(run, actId, actIndex, modifierIds);
    const match = findMatchingPaths(map, historyTypes);
    acts.push({
      actIndex,
      actId,
      actLabel: config.label,
      baseFloor,
      history,
      historyTypes: historyTypes.filter((type): type is ReplayMapPointType => type !== null),
      nodes: toReplayNodes(map),
      edges: toReplayEdges(map),
      candidateNodeIdsByStep: match.nodeCandidates,
      candidateEdgeIdsByStep: match.edgeCandidates,
      matchedPathCount: match.pathCount,
      matchedPathCountCapped: match.capped,
      exactReplay: match.pathCount === 1,
      rowCount: map.secondBoss ? map.rowCount + 2 : map.rowCount + 1,
    });
    baseFloor += history.length;
  }

  return { run, warnings, acts };
}

function collectWarnings(run: ReplayRun): string[] {
  const warnings: string[] = [];
  const modifierIds = new Set(run.modifiers.map(normalizeIdentifier).filter(Boolean));
  const deckIds = new Set(
    run.players.flatMap((player) => player.deck.map((card) => normalizeIdentifier(card.id)).filter(Boolean)),
  );
  const relicIds = new Set(
    run.players.flatMap((player) => player.relics.map((relic) => normalizeIdentifier(relic.id)).filter(Boolean)),
  );

  if (modifierIds.has("FLIGHT")) {
    warnings.push("비행 모디파이어는 경로 제약을 바꾸므로 exact replay를 보장할 수 없습니다.");
  }
  if (deckIds.has("SPOILS_MAP")) {
    warnings.push("Spoils Map 퀘스트 카드는 막 맵 구조를 바꿀 수 있습니다.");
  }
  if (relicIds.has("GOLDEN_COMPASS")) {
    warnings.push("Golden Compass 유물은 현재 막의 맵을 다시 생성할 수 있습니다.");
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
): GeneratedActMap {
  const config = ACT_CONFIGS[actId];
  const seed = toUint32(getDeterministicHashCode(run.seed));
  const hasSecondBoss = actIndex === run.acts.length - 1 && run.ascension >= 10;
  const baseRng = new StsRng(seed, `act_${actIndex + 1}_map`);
  const baseCounts = config.getCounts(baseRng, run.ascension);
  let map = new GeneratedActMap(baseRng, config, baseCounts, false, hasSecondBoss);

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
    map = new GeneratedActMap(overrideRng, config, overrideCounts, false, hasSecondBoss);
  }

  return map;
}

function findMatchingPaths(map: GeneratedActMap, historyTypes: ReplayMapPointType[]) {
  const paths: string[][] = [];
  const path: string[] = [];

  const walk = (node: MapNode, depth: number) => {
    if (paths.length >= MATCH_CAP) {
      return;
    }
    if (node.type !== historyTypes[depth]) {
      return;
    }

    path.push(node.id);
    if (depth === historyTypes.length - 1) {
      paths.push([...path]);
      path.pop();
      return;
    }

    const children = Array.from(node.children).sort(compareMapNodes);
    for (const child of children) {
      walk(child, depth + 1);
      if (paths.length >= MATCH_CAP) {
        break;
      }
    }
    path.pop();
  };

  walk(map.start, 0);

  const nodeCandidates = Array.from({ length: historyTypes.length }, () => new Set<string>());
  const edgeCandidates = Array.from({ length: historyTypes.length }, () => new Set<string>());

  for (const match of paths) {
    match.forEach((nodeId, index) => {
      nodeCandidates[index].add(nodeId);
      if (index > 0) {
        edgeCandidates[index].add(`${match[index - 1]}->${nodeId}`);
      }
    });
  }

  return {
    pathCount: paths.length,
    capped: paths.length >= MATCH_CAP,
    nodeCandidates: nodeCandidates.map((set) => Array.from(set).sort()),
    edgeCandidates: edgeCandidates.map((set) => Array.from(set).sort()),
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
  let changed = false;
  changed ||= repairPointType(map, "shop", map.pointTypeCounts.numShops);
  changed ||= repairPointType(map, "elite", map.pointTypeCounts.numElites);
  changed ||= repairPointType(map, "rest_site", map.pointTypeCounts.numRests);
  changed ||= repairPointType(map, "unknown", map.pointTypeCounts.numUnknowns);
  return changed;
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

  return Array.from(segments.values()).filter((matches) => matches.length > 1);
}

function findAllPaths(current: MapNode): MapNode[][] {
  if (current.type === "boss") {
    return [[current]];
  }

  const paths: MapNode[][] = [];
  for (const child of Array.from(current.children).sort(compareMapNodes)) {
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

    const hasSingleParentParent = Array.from(point.parents).some(
      (parent) => parent.children.size === 1 && map.isInMap(parent),
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

    const hasOutsideSingleParent = Array.from(point.children)
      .filter((child) => !remaining.includes(child))
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
