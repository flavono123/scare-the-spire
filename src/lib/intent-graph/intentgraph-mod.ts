/**
 * Schema + resolver for the STS1 "Intent Graph" mod's `intentgraph/intents/intents.json`
 * (chaofan-stsmods/intentgraph). Mirrors MonsterIntentGraph.initMonsterGraphDetail,
 * GraphLibrary.get and MonsterGraphDetail.copyAndApply so a monster's graph can be
 * resolved for a given ascension without the game runtime.
 */

export type IntentGraphEnemyType = "NORMAL" | "ELITE" | "BOSS";

export interface IntentGraphDamage {
  min?: number;
  max?: number;
  string?: string;
}

export interface IntentGraphIcon {
  x: number;
  y: number;
  /** AbstractMonster.Intent name, e.g. ATTACK, ATTACK_DEBUFF, BUFF. */
  type: string;
  damageIndex?: number;
  attackCount?: number;
  attackCountString?: string;
  percentage?: number;
  limit?: number;
}

export interface IntentGraphIconGroup {
  x: number;
  y: number;
  w: number;
  h: number;
  hide?: boolean;
}

export interface IntentGraphArrow {
  /** [startDirection (0 horizontal, 1 vertical), x0, y0, ...alternating axis targets]. */
  path: number[];
  /** Conditional transition, drawn red. */
  instant?: boolean;
}

export interface IntentGraphLabel {
  x: number;
  y: number;
  label: string;
  align?: "left" | "right" | "middle";
}

export interface IntentGraphDetail {
  id?: string;
  condition?: string;
  extend?: string;
  overwrite?: boolean;
  ascensionLevel?: number;
  width?: number;
  height?: number;
  damages?: (IntentGraphDamage | null)[];
  icons?: (IntentGraphIcon | null)[];
  iconGroups?: (IntentGraphIconGroup | null)[];
  arrows?: (IntentGraphArrow | null)[];
  labels?: (IntentGraphLabel | null)[];
}

export interface IntentGraphEntry extends IntentGraphDetail {
  graphList?: IntentGraphDetail[];
  a0?: IntentGraphDetail;
  a1?: IntentGraphDetail;
  a2?: IntentGraphDetail;
}

export type IntentGraphFile = Record<string, IntentGraphEntry>;

export interface ResolvedIntentGraph {
  ascensionLevel: number;
  width: number;
  height: number;
  damages: (IntentGraphDamage | null)[];
  icons: IntentGraphIcon[];
  iconGroups: IntentGraphIconGroup[];
  arrows: IntentGraphArrow[];
  labels: IntentGraphLabel[];
}

export interface IntentGraphContext {
  ascension: number;
  act?: number;
  index?: number;
  bossInRoom?: boolean;
  eliteTrigger?: boolean;
  /** `m.<field>` values read from the monster instance (booleans as 0/1). */
  monsterFields?: Record<string, number | boolean>;
}

// MonsterIntentGraph.initMonsterGraphDetail: legacy a1/a2 ascension thresholds by enemy type.
const LEGACY_TIERS: Record<IntentGraphEnemyType, readonly [number, number]> = {
  NORMAL: [2, 17],
  ELITE: [3, 18],
  BOSS: [4, 19],
};

function applyArray<T>(base: (T | null)[] | undefined, patch: (T | null)[] | undefined): (T | null)[] | undefined {
  if (!base) return patch;
  if (!patch) return base;
  const next = base.slice();
  patch.forEach((item, index) => {
    if (item !== null) next[index] = item;
  });
  return next;
}

/** MonsterGraphDetail.copyAndApply. */
function copyAndApply(base: IntentGraphDetail, patch: IntentGraphDetail): IntentGraphDetail {
  if (patch.overwrite) return patch;
  return {
    id: patch.id,
    condition: patch.condition,
    overwrite: base.overwrite,
    ascensionLevel: patch.ascensionLevel,
    width: patch.width || base.width,
    height: patch.height || base.height,
    damages: applyArray(base.damages, patch.damages),
    icons: applyArray(base.icons, patch.icons),
    iconGroups: applyArray(base.iconGroups, patch.iconGroups),
    arrows: applyArray(base.arrows, patch.arrows),
    labels: applyArray(base.labels, patch.labels),
  };
}

/** Ordered candidates: declared graphList reversed, then legacy a2 > a1 > a0 (first match wins). */
function candidateGraphs(entry: IntentGraphEntry, enemyType: IntentGraphEnemyType): IntentGraphDetail[] {
  const declared = (entry.graphList ?? []).slice().reverse();
  const [tier1, tier2] = LEGACY_TIERS[enemyType];
  const legacy: IntentGraphDetail[] = [];
  let last: number | null = null;
  for (const [level, detail] of [[0, entry.a0], [tier1, entry.a1], [tier2, entry.a2]] as const) {
    if (!detail) continue;
    legacy.unshift({
      ...detail,
      id: String(level),
      ascensionLevel: level,
      condition: level === 0 ? "true" : `ascension >= ${level}`,
      extend: detail.extend ?? (!detail.overwrite && last !== null ? String(last) : undefined),
    });
    last = level;
  }
  return [...declared, ...legacy];
}

function resolveExtends(graphs: IntentGraphDetail[]): IntentGraphDetail[] {
  const byId = new Map<string, IntentGraphDetail>();
  for (const graph of graphs) if (graph.id) byId.set(graph.id, graph);
  const resolved = new Map<IntentGraphDetail, IntentGraphDetail>();
  const resolve = (graph: IntentGraphDetail): IntentGraphDetail => {
    const cached = resolved.get(graph);
    if (cached) return cached;
    let result = graph;
    if (graph.extend && !graph.overwrite) {
      const parent = byId.get(graph.extend);
      if (parent && parent !== graph) result = copyAndApply(resolve(parent), graph);
    }
    resolved.set(graph, result);
    return result;
  };
  return graphs.map(resolve);
}

type Token = { kind: "op" | "int" | "bool" | "var" | "paren"; value: string };

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  const pattern = /\s*(>=|<=|==|!=|&&|\|\||[><!()]|-?\d+|true|false|m\.[A-Za-z_]\w*|[A-Za-z_]\w*)/y;
  let index = 0;
  while (index < source.length) {
    pattern.lastIndex = index;
    const match = pattern.exec(source);
    if (!match) {
      if (/^\s*$/.test(source.slice(index))) break;
      throw new Error(`Unsupported intent graph condition: ${source}`);
    }
    const value = match[1];
    index = pattern.lastIndex;
    if (value === "(" || value === ")") tokens.push({ kind: "paren", value });
    else if (/^-?\d+$/.test(value)) tokens.push({ kind: "int", value });
    else if (value === "true" || value === "false") tokens.push({ kind: "bool", value });
    else if (/^[A-Za-z_]|^m\./.test(value)) tokens.push({ kind: "var", value });
    else tokens.push({ kind: "op", value });
  }
  return tokens;
}

function variable(name: string, context: IntentGraphContext): number {
  if (name === "ascension") return context.ascension;
  if (name === "act") return context.act ?? 0;
  if (name === "index") return context.index ?? 0;
  if (name === "bossInRoom") return context.bossInRoom ? 1 : 0;
  if (name === "eliteTrigger") return context.eliteTrigger ? 1 : 0;
  if (name.startsWith("m.")) return Number(context.monsterFields?.[name.slice(2)] ?? 0);
  return 0;
}

/** Rule.g4 precedence: `!` > comparison > `&&` > `||`; values are ints, booleans are 0/1. */
export function evaluateIntentGraphCondition(source: string | undefined, context: IntentGraphContext): boolean {
  const tokens = tokenize(source ?? "true");
  let position = 0;
  const peek = () => tokens[position];
  const take = () => tokens[position++];

  const primary = (): number => {
    const token = take();
    if (!token) throw new Error(`Unexpected end of condition: ${source}`);
    if (token.kind === "op" && token.value === "!") return primary() ? 0 : 1;
    if (token.kind === "paren" && token.value === "(") {
      const value = or();
      take();
      return value;
    }
    if (token.kind === "int") return Number(token.value);
    if (token.kind === "bool") return token.value === "true" ? 1 : 0;
    if (token.kind === "var") return variable(token.value, context);
    throw new Error(`Unexpected token "${token.value}" in condition: ${source}`);
  };
  const comparison = (): number => {
    let left = primary();
    while (peek()?.kind === "op" && [">", "<", ">=", "<=", "==", "!="].includes(peek().value)) {
      const operator = take().value;
      const right = primary();
      left = Number(
        operator === ">" ? left > right
          : operator === "<" ? left < right
            : operator === ">=" ? left >= right
              : operator === "<=" ? left <= right
                : operator === "==" ? left === right
                  : left !== right,
      );
    }
    return left;
  };
  const and = (): number => {
    let left = comparison();
    while (peek()?.value === "&&") {
      take();
      const right = comparison();
      left = Number(Boolean(left) && Boolean(right));
    }
    return left;
  };
  const or = (): number => {
    let left = and();
    while (peek()?.value === "||") {
      take();
      const right = and();
      left = Number(Boolean(left) || Boolean(right));
    }
    return left;
  };
  return Boolean(or());
}

/** GraphLibrary.get for one monster entry; null when no graph matches. */
export function resolveIntentGraph(
  entry: IntentGraphEntry,
  enemyType: IntentGraphEnemyType,
  context: IntentGraphContext,
): ResolvedIntentGraph | null {
  const graphs = resolveExtends(candidateGraphs(entry, enemyType));
  const graph = graphs.find((candidate) => evaluateIntentGraphCondition(candidate.condition, context));
  if (!graph) return null;
  const compact = <T,>(items: (T | null)[] | undefined): T[] => (items ?? []).filter((item): item is T => item !== null);
  return {
    ascensionLevel: graph.ascensionLevel ?? 0,
    width: graph.width || entry.width || 0,
    height: graph.height || entry.height || 0,
    damages: (graph.damages ?? []).map((damage) => (
      damage ? { ...damage, max: Math.max(damage.max ?? damage.min ?? 0, damage.min ?? 0) } : null
    )),
    icons: compact(graph.icons).map((icon) => ({ ...icon, attackCount: icon.attackCount || 1 })),
    iconGroups: compact(graph.iconGroups).filter((group) => !group.hide),
    arrows: compact(graph.arrows),
    labels: compact(graph.labels),
  };
}
