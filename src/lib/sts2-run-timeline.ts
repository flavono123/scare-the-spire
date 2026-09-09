import {
  highlightKindsForAct,
  isTerminalDeathEntry,
  lastSceneKind,
  usesDedicatedLastScene,
  type HighlightKind,
  type LastSceneKind,
} from "@/lib/history-last-scene";
import { lastSceneDurationMs } from "@/lib/history-last-scene-steps";
import {
  type ReplayActAnalysis,
  type ReplayHistoryEntry,
  type ReplayRun,
} from "@/lib/sts2-run-replay";

// ============================================================================
// Continuous time model.
//
//  transit  = NODE_BASE_MS
//  scene    = last-scene step count × LAST_SCENE_STEP_MS (loot / cards / choice)
//             highlighted scenes use at least SCENE_HIGHLIGHT_MS.
//             Last-scene beats play at 1× wall-clock even when rate is 2×.
//  stack    = NODE_BASE_MS + stackCount × NODE_PER_STACK_MS
// ============================================================================

export const NODE_BASE_MS = 2500;
export const NODE_PER_STACK_MS = 2500;
export const SCENE_MS = 1600;
export const SCENE_HIGHLIGHT_MS = 3600;

/** Inter-act buffer so the next intro doesn't jump-cut on top of the last
 *  step's scene. */
export const ACT_TAIL_BUFFER_MS = 700;

export interface ActTimelineEntry {
  step: number; // 1-based within the act
  startMs: number;
  durationMs: number;
  stackCount: number;
  sceneKind: LastSceneKind;
  highlightKinds: HighlightKind[];
}

export interface ActTimeline {
  actIndex: number;
  entries: ActTimelineEntry[];
  totalMs: number;
}

export interface RunTimeline {
  acts: ActTimeline[];
  /** Cumulative ms at the start of each act (run-global axis). */
  actOffsets: number[];
  totalMs: number;
}

/** Count of stack items the NodeActionStack will emit for a given history
 *  entry. Mirrors `buildStackItems` in `history-course-shell.tsx` — keep in
 *  sync. Pulled out as a pure function so the timeline build doesn't need
 *  the React-side icon factories. */
export function countStackItems(entry: ReplayHistoryEntry): number {
  const damage = (entry.damage_taken ?? 0) > 0 ? 1 : 0;
  const heal = (entry.hp_healed ?? 0) > 0 ? 1 : 0;
  const maxUp = (entry.max_hp_gained ?? 0) > 0 ? 1 : 0;
  const maxDown = (entry.max_hp_lost ?? 0) > 0 ? 1 : 0;
  const gained = (entry.cards_gained ?? []).filter((c) => c.id).length;
  const upgraded = (entry.upgraded_cards ?? []).length;
  const enchanted = (entry.cards_enchanted ?? []).length;
  const removed = (entry.cards_removed ?? []).filter((c) => c.id).length;
  const transformed = (entry.cards_transformed ?? []).filter(
    (row) => row.original.id && row.final.id,
  ).length * 2;
  const potionsGained = (entry.potion_choices ?? []).filter(
    (c) => c.picked && c.id,
  ).length;
  const potionsUsed = (entry.potion_used ?? []).length;
  const potionsDiscarded = (entry.potion_discarded ?? []).length;
  const choices = entry.card_choices ?? [];
  const skipped =
    choices.length > 0 && !choices.some((c) => c.picked) && gained === 0
      ? 1
      : 0;
  const relics = (entry.relic_choices ?? []).filter(
    (c) => c.picked && c.id,
  ).length;
  const restSite = (entry.rest_site_choices ?? []).length;
  return (
    damage + heal + maxUp + maxDown +
    potionsUsed + potionsDiscarded + potionsGained +
    gained + upgraded + enchanted + removed + transformed + skipped + relics +
    restSite
  );
}

export function nodeDurationMs(stackCount: number): number {
  return NODE_BASE_MS + Math.max(0, stackCount) * NODE_PER_STACK_MS;
}

export function sceneDurationMs(highlight: boolean): number {
  return highlight ? SCENE_HIGHLIGHT_MS : SCENE_MS;
}

export function nodeDurationForEntry(
  entry: ReplayHistoryEntry,
  opts: { sceneKind: LastSceneKind; highlight: boolean },
): number {
  if (!usesDedicatedLastScene(opts.sceneKind)) {
    return nodeDurationMs(countStackItems(entry));
  }
  const sceneMs = lastSceneDurationMs(opts.sceneKind, entry);
  return NODE_BASE_MS + (opts.highlight ? Math.max(sceneMs, SCENE_HIGHLIGHT_MS) : sceneMs);
}

/** Offset within the node where the stack / last scene starts. The leading
 *  NODE_BASE_MS is the transit phase (path tick trail painting + character
 *  arrival). */
export function stackStartOffsetMs(): number {
  return NODE_BASE_MS;
}

export function buildActTimeline(
  act: ReplayActAnalysis,
  ctx?: { run?: ReplayRun; acts?: ReplayActAnalysis[] },
): ActTimeline {
  const acts = ctx?.acts ?? [act];
  const highlightByEntry = highlightKindsForAct(act.history, {
    isLastAct: act.actIndex === acts.length - 1,
    run: ctx?.run,
    actIndex: act.actIndex,
    acts,
  });
  let cursor = 0;
  const entries: ActTimelineEntry[] = act.history.map((entry, idx) => {
    const isTerminalDeath = isTerminalDeathEntry(
      ctx?.run,
      acts,
      act.actIndex,
      idx,
    );
    const sceneKind = lastSceneKind(entry, { isTerminalDeath });
    const highlightKinds = highlightByEntry[idx] ?? [];
    const durationMs = nodeDurationForEntry(entry, {
      sceneKind,
      highlight: highlightKinds.length > 0,
    });
    const out: ActTimelineEntry = {
      step: idx + 1,
      startMs: cursor,
      durationMs,
      stackCount: countStackItems(entry),
      sceneKind,
      highlightKinds,
    };
    cursor += durationMs;
    return out;
  });
  return { actIndex: act.actIndex, entries, totalMs: cursor };
}

export function buildRunTimeline(
  acts: ReplayActAnalysis[],
  run?: ReplayRun,
): RunTimeline {
  const actTimelines = acts.map((act) => buildActTimeline(act, { run, acts }));
  const actOffsets: number[] = [];
  let cursor = 0;
  for (const at of actTimelines) {
    actOffsets.push(cursor);
    cursor += at.totalMs + ACT_TAIL_BUFFER_MS;
  }
  const totalMs = Math.max(0, cursor - ACT_TAIL_BUFFER_MS);
  return { acts: actTimelines, actOffsets, totalMs };
}

/** Binary-search the entry whose startMs is the latest <= elapsedMs.
 *  Returns step 1 when elapsedMs is below the first entry. */
export function stepFromElapsed(
  timeline: ActTimeline,
  elapsedMs: number,
): number {
  if (timeline.entries.length === 0) return 1;
  if (elapsedMs <= 0) return 1;
  let lo = 0;
  let hi = timeline.entries.length - 1;
  let ans = timeline.entries[0].step;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (timeline.entries[mid].startMs <= elapsedMs) {
      ans = timeline.entries[mid].step;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

export interface ActPosition {
  actIndex: number;
  actLocalMs: number;
}

/** Map a run-global ms onto (actIndex, actLocalMs).
 *
 *  The trailing ACT_TAIL_BUFFER_MS still belongs to the *previous* act —
 *  the stack is gone but the map should hold on the last step until the
 *  next intro fires. Past the last act's tail, the position pins to the
 *  last act's totalMs. */
export function actPositionFromGlobalMs(
  timeline: RunTimeline,
  globalMs: number,
): ActPosition {
  if (timeline.acts.length === 0) {
    return { actIndex: 0, actLocalMs: 0 };
  }
  const clamped = Math.max(0, Math.min(globalMs, timeline.totalMs));
  for (let i = timeline.acts.length - 1; i >= 0; i--) {
    if (clamped >= timeline.actOffsets[i]) {
      const local = clamped - timeline.actOffsets[i];
      const actTotal = timeline.acts[i].totalMs;
      return { actIndex: i, actLocalMs: Math.min(local, actTotal) };
    }
  }
  return { actIndex: 0, actLocalMs: 0 };
}

/** Run-global startMs for the (actIndex, step) pair — used by node-marker
 *  click jumps and the InfoDrawer "select act" entry point. */
export function globalMsForStep(
  timeline: RunTimeline,
  actIndex: number,
  step: number,
): number {
  const act = timeline.acts[actIndex];
  if (!act) return 0;
  const entry = act.entries[step - 1];
  if (!entry) return timeline.actOffsets[actIndex] ?? 0;
  return (timeline.actOffsets[actIndex] ?? 0) + entry.startMs;
}
