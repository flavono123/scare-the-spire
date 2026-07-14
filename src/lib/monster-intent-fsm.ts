import type { ServiceLocale } from "@/lib/i18n";
import type {
  MonsterMoveGraph,
  MonsterMoveGraphConditionalState,
  MonsterMoveGraphMoveState,
  MonsterMoveTransition,
} from "@/lib/codex-types";

export type MonsterIntentFsmKind =
  | "terminal"
  | "one-way"
  | "fixed-loop"
  | "random-loop"
  | "conditional-loop"
  | "conditional-random-loop"
  | "reversible-phases"
  | "progressive-phases"
  | "partial"
  | "unknown";

export type MonsterIntentPhaseLayout = "none" | "vertical" | "horizontal";

export interface MonsterIntentPhaseModel {
  id: string;
  moveIds: string[];
  entryMoveId: string;
  incomingCondition: string | null;
  bridgeMoveId: string | null;
}

export interface MonsterIntentFsmModel {
  kind: MonsterIntentFsmKind;
  phaseLayout: MonsterIntentPhaseLayout;
  phases: MonsterIntentPhaseModel[];
}

export interface MonsterIntentConditionDescriptor {
  label: string;
  tooltip: string;
}

interface ActionGraph {
  moves: MonsterMoveGraphMoveState[];
  moveIds: string[];
  moveIdSet: Set<string>;
  transitions: MonsterMoveTransition[];
  outgoing: Map<string, MonsterMoveTransition[]>;
  incoming: Map<string, MonsterMoveTransition[]>;
}

export function classifyMonsterIntentFsm(graph: MonsterMoveGraph | null): MonsterIntentFsmModel {
  if (!graph || !graph.states || graph.states.length === 0) {
    return { kind: "unknown", phaseLayout: "none", phases: [] };
  }

  const actionGraph = buildActionGraph(graph);
  if (graph.confidence === "partial") {
    return { kind: "partial", phaseLayout: "none", phases: [] };
  }
  if (actionGraph.moves.length === 1 && actionGraph.transitions.length === 0) {
    return { kind: "terminal", phaseLayout: "none", phases: [] };
  }

  const reversible = buildReversiblePhaseModel(graph, actionGraph);
  if (reversible.length > 1) {
    return { kind: "reversible-phases", phaseLayout: "vertical", phases: reversible };
  }

  const progressive = buildProgressivePhaseModel(graph, actionGraph);
  if (progressive.length > 1) {
    return { kind: "progressive-phases", phaseLayout: "horizontal", phases: progressive };
  }

  const hasRandom = graph.states.some((state) => state.kind === "random");
  const hasConditional = graph.states.some((state) => state.kind === "conditional");
  if (!hasRecurrentComponent(actionGraph)) {
    return { kind: "one-way", phaseLayout: "none", phases: [] };
  }
  if (hasRandom && hasConditional) {
    return { kind: "conditional-random-loop", phaseLayout: "none", phases: [] };
  }
  if (hasConditional) {
    return { kind: "conditional-loop", phaseLayout: "none", phases: [] };
  }
  if (hasRandom) {
    return { kind: "random-loop", phaseLayout: "none", phases: [] };
  }
  return { kind: "fixed-loop", phaseLayout: "none", phases: [] };
}

export function getMonsterIntentConditionDescriptor(
  condition: string | null | undefined,
  serviceLocale: ServiceLocale,
): MonsterIntentConditionDescriptor | null {
  if (!condition) return null;
  const ko = serviceLocale === "ko";
  const exact = CONDITION_TEXT[condition];
  if (exact) return ko ? exact.ko : exact.en;

  const conjunction = condition.match(/^\((.*)\) && \((.*)\)$/);
  if (conjunction) {
    const left = getMonsterIntentConditionDescriptor(conjunction[1], serviceLocale);
    const right = getMonsterIntentConditionDescriptor(conjunction[2], serviceLocale);
    if (left && right) {
      return {
        label: `${left.label} · ${right.label}`,
        tooltip: `${left.tooltip} ${right.tooltip}`,
      };
    }
  }

  const starterIndex = condition.match(/^(?:StarterMoveIdx|StarterMoveIndex) % \d+ == (\d+)$/);
  if (starterIndex) {
    const order = Number(starterIndex[1]) + 1;
    return ko
      ? {
          label: `시작 순서 ${order}`,
          tooltip: `전투 구성에서 시작 행동 인덱스가 ${order}번째 행동으로 지정된 경우입니다.`,
        }
      : {
          label: `Start order ${order}`,
          tooltip: `Used when the encounter setup selects the ${ordinal(order)} move as the initial action.`,
        };
  }

  const slot = condition.match(/^base\.Creature\.SlotName == "(first|second|third|fourth|wriggler[1-4])"$/);
  if (slot) {
    const slotLabel = SLOT_LABELS[slot[1]];
    return ko
      ? { label: slotLabel.ko, tooltip: `전투에서 배치 위치가 ${slotLabel.ko}일 때 선택됩니다.` }
      : { label: slotLabel.en, tooltip: `Selected when the combat slot is ${slotLabel.en.toLowerCase()}.` };
  }

  return ko
    ? { label: "조건 충족", tooltip: `게임 조건: ${condition}` }
    : { label: "Condition met", tooltip: `Game condition: ${condition}` };
}

function ordinal(value: number): string {
  const remainder = value % 100;
  if (remainder >= 11 && remainder <= 13) return `${value}th`;
  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
}

function buildActionGraph(graph: MonsterMoveGraph): ActionGraph {
  const moves = (graph.states ?? []).filter((state): state is MonsterMoveGraphMoveState => state.kind === "move");
  const moveIds = moves.map((move) => move.id);
  const moveIdSet = new Set(moveIds);
  const transitions = graph.transitions.filter((transition) => (
    transition.from !== "__START__"
    && moveIdSet.has(transition.from)
    && moveIdSet.has(transition.to)
  ));
  const outgoing = new Map<string, MonsterMoveTransition[]>();
  const incoming = new Map<string, MonsterMoveTransition[]>();
  transitions.forEach((transition) => {
    outgoing.set(transition.from, [...(outgoing.get(transition.from) ?? []), transition]);
    incoming.set(transition.to, [...(incoming.get(transition.to) ?? []), transition]);
  });
  return { moves, moveIds, moveIdSet, transitions, outgoing, incoming };
}

function buildReversiblePhaseModel(
  graph: MonsterMoveGraph,
  actionGraph: ActionGraph,
): MonsterIntentPhaseModel[] {
  const states = graph.states ?? [];
  const stateById = new Map(states.map((state) => [state.id, state]));
  const candidates = states.filter((state): state is MonsterMoveGraphConditionalState => state.kind === "conditional");

  for (const conditional of candidates) {
    if (graph.initial !== conditional.id || conditional.branches.length !== 2) continue;
    if (!actionGraph.moves.every((move) => move.next === conditional.id)) continue;

    const branchMoveIds = conditional.branches.map((branch) => {
      const target = stateById.get(branch.to);
      if (target?.kind === "move") return [target.id];
      if (target?.kind === "random") return target.branches.map((randomBranch) => randomBranch.to);
      return [];
    });
    if (branchMoveIds.some((moveIds) => moveIds.length === 0)) continue;
    const randomBranchIndex = conditional.branches.findIndex((branch) => stateById.get(branch.to)?.kind === "random");
    if (randomBranchIndex < 0) continue;

    const orderedBranchIndexes = [randomBranchIndex, randomBranchIndex === 0 ? 1 : 0];
    return orderedBranchIndexes.map((branchIndex, phaseIndex) => {
      const moveIds = branchMoveIds[branchIndex];
      return {
        id: `mode-${phaseIndex + 1}`,
        moveIds,
        entryMoveId: moveIds[0],
        incomingCondition: conditional.branches[branchIndex].condition,
        bridgeMoveId: null,
      };
    });
  }
  return [];
}

function buildProgressivePhaseModel(
  graph: MonsterMoveGraph,
  actionGraph: ActionGraph,
): MonsterIntentPhaseModel[] {
  const components = getStronglyConnectedComponents(actionGraph.moveIds, actionGraph.outgoing);
  const recurrent = components.filter((component) => (
    component.length > 1
    || (actionGraph.outgoing.get(component[0]) ?? []).some((transition) => transition.to === component[0])
  ));
  if (recurrent.length <= 1) return [];

  const stateOrder = new Map(actionGraph.moveIds.map((moveId, index) => [moveId, index]));
  const startMoveIds = getStartMoveIds(graph, actionGraph);
  const distance = getDistances(startMoveIds, actionGraph.outgoing);
  const orderedCores = [...recurrent].sort((left, right) => {
    const leftDistance = Math.min(...left.map((moveId) => distance.get(moveId) ?? Number.MAX_SAFE_INTEGER));
    const rightDistance = Math.min(...right.map((moveId) => distance.get(moveId) ?? Number.MAX_SAFE_INTEGER));
    if (leftDistance !== rightDistance) return leftDistance - rightDistance;
    return minStateOrder(left, stateOrder) - minStateOrder(right, stateOrder);
  });
  const phaseByCoreMove = new Map<string, number>();
  orderedCores.forEach((component, phaseIndex) => {
    component.forEach((moveId) => phaseByCoreMove.set(moveId, phaseIndex));
  });

  const startReachable = new Set(distance.keys());
  const reachableCoreCache = new Map<string, Set<number>>();
  const reachableCores = (moveId: string, seen = new Set<string>()): Set<number> => {
    const cached = reachableCoreCache.get(moveId);
    if (cached) return new Set(cached);
    const directPhase = phaseByCoreMove.get(moveId);
    if (directPhase != null) return new Set([directPhase]);
    if (seen.has(moveId)) return new Set();
    const nextSeen = new Set(seen).add(moveId);
    const result = new Set<number>();
    for (const transition of actionGraph.outgoing.get(moveId) ?? []) {
      reachableCores(transition.to, nextSeen).forEach((phaseIndex) => result.add(phaseIndex));
    }
    reachableCoreCache.set(moveId, result);
    return new Set(result);
  };

  const phaseByMove = new Map<string, number>(phaseByCoreMove);
  actionGraph.moveIds.forEach((moveId) => {
    if (phaseByMove.has(moveId)) return;
    const reachable = [...reachableCores(moveId)].sort((a, b) => a - b);
    if (reachable.length === 1 || (reachable.length > 1 && startReachable.has(moveId))) {
      phaseByMove.set(moveId, reachable[0]);
    }
  });

  return orderedCores.map((_, phaseIndex) => {
    const phaseMoveIds = actionGraph.moveIds.filter((moveId) => phaseByMove.get(moveId) === phaseIndex);
    const previousMoveIds = new Set(actionGraph.moveIds.filter((moveId) => {
      const assigned = phaseByMove.get(moveId);
      return assigned != null && assigned < phaseIndex;
    }));
    const directIncoming = actionGraph.transitions.find((transition) => (
      previousMoveIds.has(transition.from) && phaseByMove.get(transition.to) === phaseIndex
    ));
    const bridgeIncoming = actionGraph.transitions.find((transition) => (
      !phaseByMove.has(transition.from) && phaseByMove.get(transition.to) === phaseIndex
    ));
    const entryMoveId = directIncoming?.to
      ?? bridgeIncoming?.to
      ?? findPhaseEntryMove(phaseMoveIds, actionGraph, phaseByMove, phaseIndex, stateOrder, startMoveIds);
    const orderedMoveIds = orderPhaseMoves(entryMoveId, phaseMoveIds, actionGraph.outgoing, stateOrder);
    const bridgeMoveId = bridgeIncoming?.from
      ?? (!directIncoming && phaseIndex > 0 ? entryMoveId : null);

    return {
      id: `phase-${phaseIndex + 1}`,
      moveIds: orderedMoveIds,
      entryMoveId,
      incomingCondition: directIncoming?.condition ?? bridgeIncoming?.condition ?? null,
      bridgeMoveId,
    };
  });
}

function getStartMoveIds(graph: MonsterMoveGraph, actionGraph: ActionGraph): string[] {
  if (graph.initial && actionGraph.moveIdSet.has(graph.initial)) return [graph.initial];
  return graph.transitions
    .filter((transition) => transition.from === "__START__" && actionGraph.moveIdSet.has(transition.to))
    .map((transition) => transition.to);
}

function findPhaseEntryMove(
  phaseMoveIds: string[],
  actionGraph: ActionGraph,
  phaseByMove: Map<string, number>,
  phaseIndex: number,
  stateOrder: Map<string, number>,
  startMoveIds: string[],
): string {
  const start = startMoveIds.find((moveId) => phaseByMove.get(moveId) === phaseIndex);
  if (start) return start;
  const noInternalIncoming = phaseMoveIds.find((moveId) => (
    !(actionGraph.incoming.get(moveId) ?? []).some((transition) => phaseByMove.get(transition.from) === phaseIndex)
  ));
  return noInternalIncoming
    ?? [...phaseMoveIds].sort((left, right) => (stateOrder.get(left) ?? 0) - (stateOrder.get(right) ?? 0))[0];
}

function orderPhaseMoves(
  entryMoveId: string,
  phaseMoveIds: string[],
  outgoing: Map<string, MonsterMoveTransition[]>,
  stateOrder: Map<string, number>,
): string[] {
  const phaseMoveSet = new Set(phaseMoveIds);
  const ordered: string[] = [];
  const queue = [entryMoveId];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || seen.has(current) || !phaseMoveSet.has(current)) continue;
    seen.add(current);
    ordered.push(current);
    for (const transition of outgoing.get(current) ?? []) {
      if (phaseMoveSet.has(transition.to) && !seen.has(transition.to)) queue.push(transition.to);
    }
  }
  const remaining = phaseMoveIds
    .filter((moveId) => !seen.has(moveId))
    .sort((left, right) => (stateOrder.get(left) ?? 0) - (stateOrder.get(right) ?? 0));
  return [...ordered, ...remaining];
}

function hasRecurrentComponent(actionGraph: ActionGraph): boolean {
  return getStronglyConnectedComponents(actionGraph.moveIds, actionGraph.outgoing).some((component) => (
    component.length > 1
    || (actionGraph.outgoing.get(component[0]) ?? []).some((transition) => transition.to === component[0])
  ));
}

function getStronglyConnectedComponents(
  nodes: string[],
  outgoing: Map<string, MonsterMoveTransition[]>,
): string[][] {
  const indexByNode = new Map<string, number>();
  const lowLinkByNode = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const components: string[][] = [];
  let nextIndex = 0;

  const visit = (node: string) => {
    indexByNode.set(node, nextIndex);
    lowLinkByNode.set(node, nextIndex);
    nextIndex += 1;
    stack.push(node);
    onStack.add(node);
    for (const transition of outgoing.get(node) ?? []) {
      const next = transition.to;
      if (!indexByNode.has(next)) {
        visit(next);
        lowLinkByNode.set(node, Math.min(lowLinkByNode.get(node) ?? 0, lowLinkByNode.get(next) ?? 0));
      } else if (onStack.has(next)) {
        lowLinkByNode.set(node, Math.min(lowLinkByNode.get(node) ?? 0, indexByNode.get(next) ?? 0));
      }
    }
    if (lowLinkByNode.get(node) !== indexByNode.get(node)) return;
    const component: string[] = [];
    let current: string | undefined;
    do {
      current = stack.pop();
      if (!current) break;
      onStack.delete(current);
      component.push(current);
    } while (current !== node);
    components.push(component);
  };
  nodes.forEach((node) => {
    if (!indexByNode.has(node)) visit(node);
  });
  return components;
}

function getDistances(
  starts: string[],
  outgoing: Map<string, MonsterMoveTransition[]>,
): Map<string, number> {
  const distances = new Map<string, number>();
  const queue = starts.map((moveId) => ({ moveId, distance: 0 }));
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || distances.has(current.moveId)) continue;
    distances.set(current.moveId, current.distance);
    for (const transition of outgoing.get(current.moveId) ?? []) {
      if (!distances.has(transition.to)) queue.push({ moveId: transition.to, distance: current.distance + 1 });
    }
  }
  return distances;
}

function minStateOrder(component: string[], stateOrder: Map<string, number>): number {
  return Math.min(...component.map((moveId) => stateOrder.get(moveId) ?? Number.MAX_SAFE_INTEGER));
}

const SLOT_LABELS: Record<string, { ko: string; en: string }> = {
  first: { ko: "첫 번째 위치", en: "First position" },
  second: { ko: "두 번째 위치", en: "Second position" },
  third: { ko: "세 번째 위치", en: "Third position" },
  fourth: { ko: "네 번째 위치", en: "Fourth position" },
  wriggler1: { ko: "꿈틀벌레 1번 위치", en: "Wriggler slot 1" },
  wriggler2: { ko: "꿈틀벌레 2번 위치", en: "Wriggler slot 2" },
  wriggler3: { ko: "꿈틀벌레 3번 위치", en: "Wriggler slot 3" },
  wriggler4: { ko: "꿈틀벌레 4번 위치", en: "Wriggler slot 4" },
};

const CONDITION_TEXT: Record<string, {
  ko: MonsterIntentConditionDescriptor;
  en: MonsterIntentConditionDescriptor;
}> = {
  _screamFirst: {
    ko: { label: "비명으로 시작", tooltip: "전투 구성에서 깨무는 자가 비명을 먼저 사용하도록 지정된 경우입니다." },
    en: { label: "Screech first", tooltip: "Used when the encounter setup makes the Chomper open with Screech." },
  },
  "!_screamFirst": {
    ko: { label: "죔쇠로 시작", tooltip: "전투 구성에서 깨무는 자가 죔쇠를 먼저 사용하도록 지정된 경우입니다." },
    en: { label: "Clamp first", tooltip: "Used when the encounter setup makes the Chomper open with Clamp." },
  },
  _middleInklet: {
    ko: { label: "가운데 먹물둥이", tooltip: "가운데에 배치된 먹물둥이는 회오리바람으로 시작합니다." },
    en: { label: "Middle Inklet", tooltip: "The Inklet placed in the middle opens with Whirlwind." },
  },
  "!_middleInklet": {
    ko: { label: "바깥 먹물둥이", tooltip: "가운데가 아닌 먹물둥이는 잽으로 시작합니다." },
    en: { label: "Outer Inklet", tooltip: "An Inklet outside the middle position opens with Jab." },
  },
  StartsWithDance: {
    ko: { label: "힘의 춤으로 시작", tooltip: "전투 구성에서 추종자가 힘의 춤으로 시작하도록 지정된 경우입니다." },
    en: { label: "Power Dance first", tooltip: "Used when the encounter setup makes the Kin Follower open with Power Dance." },
  },
  "!StartsWithDance": {
    ko: { label: "빠른 베기로 시작", tooltip: "전투 구성에서 추종자가 빠른 베기로 시작하도록 지정된 경우입니다." },
    en: { label: "Quick Slash first", tooltip: "Used when the encounter setup makes the Kin Follower open with Quick Slash." },
  },
  StartsWithFastPunch: {
    ko: { label: "빠른 주먹으로 시작", tooltip: "전투 구성에서 주먹 구조체가 빠른 주먹으로 시작하도록 지정된 경우입니다." },
    en: { label: "Fast Punch first", tooltip: "Used when the encounter setup makes the Punch Construct open with Fast Punch." },
  },
  "!StartsWithFastPunch": {
    ko: { label: "준비로 시작", tooltip: "전투 구성에서 주먹 구조체가 준비로 시작하도록 지정된 경우입니다." },
    en: { label: "Ready first", tooltip: "Used when the encounter setup makes the Punch Construct open with Ready." },
  },
  StartStunned: {
    ko: { label: "기절 상태로 등장", tooltip: "소환되어 등장한 꿈틀벌레가 첫 턴에 기절 상태를 거치는 경우입니다." },
    en: { label: "Spawn stunned", tooltip: "Used when a summoned Wriggler enters combat stunned for its first turn." },
  },
  "!StartStunned": {
    ko: { label: "일반 상태로 등장", tooltip: "꿈틀벌레가 기절 상태를 거치지 않고 위치별 첫 행동을 선택하는 경우입니다." },
    en: { label: "Spawn active", tooltip: "Used when a Wriggler skips the stunned turn and chooses its slot-based opener." },
  },
  "StarterMoveIndex == -1": {
    ko: { label: "무작위 시작", tooltip: "전투 구성에서 시작 행동을 지정하지 않아 무작위 분기에서 첫 행동을 선택합니다." },
    en: { label: "Random start", tooltip: "The first action is selected from the random branch when the encounter does not specify a starting move." },
  },
  "!(StarterMoveIndex == -1)": {
    ko: { label: "지정된 시작", tooltip: "전투 구성에서 시작 행동 인덱스를 지정한 경우입니다." },
    en: { label: "Preset start", tooltip: "Used when the encounter specifies a starting move index." },
  },
  "_stockOverrideAmount.HasValue": {
    ko: { label: "재고를 소모해 부활", tooltip: "잘라봇이 재고를 소모해 부활한 개체라면 시동으로 시작합니다." },
    en: { label: "Revived from Stock", tooltip: "A replacement Axebot revived by spending Stock opens with Boot Up." },
  },
  "!(_stockOverrideAmount.HasValue)": {
    ko: { label: "최초 등장", tooltip: "재고를 소모해 부활한 개체가 아닌 최초 잘라봇은 해머 어퍼컷으로 시작합니다." },
    en: { label: "Initial spawn", tooltip: "The initial Axebot, before any Stock revival, opens with Hammer Uppercut." },
  },
  CanFabricate: {
    ko: {
      label: "제작 가능",
      tooltip: "조립 전문가 자신을 포함해 같은 편에서 살아 있는 적이 4명 미만일 때 제작할 수 있습니다.",
    },
    en: {
      label: "Can Fabricate",
      tooltip: "Fabrication is available while fewer than 4 living enemies remain on the Fabricator's side, including the Fabricator.",
    },
  },
  "!CanFabricate": {
    ko: {
      label: "제작 불가",
      tooltip: "조립 전문가 자신을 포함해 같은 편에서 살아 있는 적이 4명 이상이면 제작할 수 없습니다.",
    },
    en: {
      label: "Cannot Fabricate",
      tooltip: "Fabrication is unavailable while at least 4 living enemies remain on the Fabricator's side, including the Fabricator.",
    },
  },
  IsOffBalance: {
    ko: { label: "균형 상실", tooltip: "머리 박치기 뒤 균형을 잃은 상태일 때 어지럼을 사용합니다." },
    en: { label: "Off balance", tooltip: "Uses Dizzy after Headbutt while off balance." },
  },
  "!IsOffBalance": {
    ko: { label: "균형 유지", tooltip: "머리 박치기 뒤 균형을 잃지 않았을 때 머리 박치기를 반복합니다." },
    en: { label: "Still balanced", tooltip: "Repeats Headbutt when it remains balanced after Headbutt." },
  },
  "HasBeetleCharged || base.Creature.CurrentHp >= base.Creature.MaxHp / 2": {
    ko: { label: "충전 완료 또는 체력 50% 이상", tooltip: "딱정벌레 충전을 이미 사용했거나 현재 체력이 최대 체력의 절반 이상일 때입니다." },
    en: { label: "Charged or at least 50% HP", tooltip: "True after Beetle Charge has been used, or while current HP is at least half of maximum HP." },
  },
  "!HasBeetleCharged && base.Creature.CurrentHp < base.Creature.MaxHp / 2": {
    ko: { label: "체력 50% 미만·미충전", tooltip: "딱정벌레 충전을 아직 사용하지 않았고 현재 체력이 최대 체력의 절반 미만일 때입니다." },
    en: { label: "Below 50% HP and uncharged", tooltip: "True before Beetle Charge has been used and while current HP is below half of maximum HP." },
  },
  "_curseOfKnowledgeCounter < 3": {
    ko: { label: "지식의 저주 3회 미만", tooltip: "지식의 저주 사용 횟수가 3회 미만일 때입니다." },
    en: { label: "Fewer than 3 Curses", tooltip: "True while Curse of Knowledge has been used fewer than 3 times." },
  },
  "_curseOfKnowledgeCounter >= 3": {
    ko: { label: "지식의 저주 3회 이상", tooltip: "지식의 저주 사용 횟수가 3회 이상일 때입니다." },
    en: { label: "At least 3 Curses", tooltip: "True after Curse of Knowledge has been used at least 3 times." },
  },
  "base.Creature.HasPower<AsleepPower>()": {
    ko: { label: "수면 유지", tooltip: "수면 파워가 남아 있는 동안 잠을 계속 잡니다." },
    en: { label: "Still asleep", tooltip: "Continues sleeping while Asleep is still present." },
  },
  "!base.Creature.HasPower<AsleepPower>()": {
    ko: { label: "깨어남", tooltip: "수면 파워가 사라지면 공격 페이즈로 진행합니다." },
    en: { label: "Awakened", tooltip: "Advances to the attack phase after Asleep is removed." },
  },
  "GetAllyCount() > 0": {
    ko: { label: "살아 있는 아군 있음", tooltip: "자신을 제외한 살아 있는 아군이 1명 이상일 때입니다." },
    en: { label: "Living ally present", tooltip: "True while at least 1 other living ally remains." },
  },
  "GetAllyCount() == 0": {
    ko: { label: "살아 있는 아군 없음", tooltip: "자신을 제외한 살아 있는 아군이 없을 때입니다." },
    en: { label: "No living allies", tooltip: "True when no other living allies remain." },
  },
  "((Nibbit)base.Creature.Monster).IsAlone": {
    ko: { label: "혼자 남음", tooltip: "깨작이가 전투에서 혼자 남았을 때입니다." },
    en: { label: "Alone", tooltip: "True when the Nibbit is alone in combat." },
  },
  "!((Nibbit)base.Creature.Monster).IsFront": {
    ko: { label: "후방", tooltip: "깨작이가 전열이 아닐 때입니다." },
    en: { label: "Not in front", tooltip: "True when the Nibbit is not in the front position." },
  },
  "((Nibbit)base.Creature.Monster).IsFront": {
    ko: { label: "전방", tooltip: "깨작이가 전열에 있을 때입니다." },
    en: { label: "In front", tooltip: "True when the Nibbit is in the front position." },
  },
  CanLay: {
    ko: { label: "산란 가능", tooltip: "산란 조건을 만족해 알을 낳을 수 있을 때입니다." },
    en: { label: "Can lay eggs", tooltip: "True while the Ovicopter's summoning condition allows it to lay eggs." },
  },
  "!CanLay": {
    ko: { label: "산란 불가", tooltip: "산란 조건을 만족하지 못해 알을 낳을 수 없을 때입니다." },
    en: { label: "Cannot lay eggs", tooltip: "True while the Ovicopter's summoning condition prevents it from laying eggs." },
  },
  "!HasAmalgamDied": {
    ko: { label: "융합체 생존", tooltip: "횃불머리 융합체가 아직 살아 있을 때입니다." },
    en: { label: "Amalgam alive", tooltip: "True while the Torch Head Amalgam is still alive." },
  },
  HasAmalgamDied: {
    ko: { label: "융합체 사망", tooltip: "횃불머리 융합체가 사망하면 이후 페이즈로 진행합니다." },
    en: { label: "Amalgam defeated", tooltip: "Advances to the later phase after the Torch Head Amalgam dies." },
  },
  "base.Creature.HasPower<SlumberPower>()": {
    ko: { label: "선잠 유지", tooltip: "선잠 파워가 남아 있는 동안 코골이를 반복합니다." },
    en: { label: "Still slumbering", tooltip: "Repeats Snore while Slumber is still present." },
  },
  "!base.Creature.HasPower<SlumberPower>()": {
    ko: { label: "깨어남", tooltip: "선잠 파워가 사라지면 구르기 페이즈로 진행합니다." },
    en: { label: "Awakened", tooltip: "Advances to the Roll Out phase after Slumber is removed." },
  },
  "Respawns < 2": {
    ko: { label: "두 번째 형태", tooltip: "첫 번째 부활 뒤 부활 횟수가 2회 미만일 때 두 번째 형태로 진행합니다." },
    en: { label: "Second form", tooltip: "Enters the second form after the first revival, while the respawn count is below 2." },
  },
  "Respawns >= 2": {
    ko: { label: "세 번째 형태", tooltip: "두 번째 부활 뒤 부활 횟수가 2회 이상일 때 세 번째 형태로 진행합니다." },
    en: { label: "Third form", tooltip: "Enters the third form after the second revival, when the respawn count reaches 2." },
  },
  "!((Toadpole)base.Creature.Monster).IsFront": {
    ko: { label: "후방", tooltip: "올챙이가 전열이 아닐 때의 시작 행동입니다." },
    en: { label: "Not in front", tooltip: "Initial move used when the Toadpole is not in the front position." },
  },
  "((Toadpole)base.Creature.Monster).IsFront": {
    ko: { label: "전방", tooltip: "올챙이가 전열에 있을 때의 시작 행동입니다." },
    en: { label: "In front", tooltip: "Initial move used when the Toadpole is in the front position." },
  },
};
