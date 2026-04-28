import {
  type ReplayActAnalysis,
  type ReplayHistoryEntry,
  type ReplayRun,
} from "@/lib/sts2-run-replay";

// ============================================================================
// Continuous time model — every node gets a fixed budget that scales with
// the number of stack items at that node. The driver runs a rAF ticker over
// elapsedMs; the displayed step is derived from cumulative startMs so the
// progress bar / clock keep moving even mid-node.
//
//  1× budget per node  =  base 2500 ms  +  500 ms × stack item count
//  50 floors w/ avg 1.5 stack items     ≈  2 minutes
// ============================================================================

export const NODE_BASE_MS = 2500;
export const NODE_PER_STACK_MS = 800;

/** Stack should finish a hair before the node ends so the next step's
 *  intro doesn't overlap mid-fade with the previous stack's tail. */
export const STACK_BUDGET_FRACTION = 0.85;

/** Inter-act buffer so the next intro doesn't jump-cut on top of the last
 *  step's stack. */
export const ACT_TAIL_BUFFER_MS = 700;

export interface ActTimelineEntry {
  step: number; // 1-based within the act
  startMs: number;
  durationMs: number;
  stackCount: number;
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
  const gained = (entry.cards_gained ?? []).filter((c) => c.id).length;
  const upgraded = (entry.upgraded_cards ?? []).length;
  const enchanted = (entry.cards_enchanted ?? []).length;
  const choices = entry.card_choices ?? [];
  const skipped =
    choices.length > 0 && !choices.some((c) => c.picked) && gained === 0
      ? 1
      : 0;
  const relics = (entry.relic_choices ?? []).filter(
    (c) => c.picked && c.id,
  ).length;
  return gained + upgraded + enchanted + skipped + relics;
}

export function nodeDurationMs(stackCount: number): number {
  return NODE_BASE_MS + Math.max(0, stackCount) * NODE_PER_STACK_MS;
}

/** Budget the NodeActionStack should use for the whole stack. Slightly
 *  smaller than nodeDurationMs so the post-effect of the last item lands
 *  before the node ticks over. */
export function stackBudgetMs(stackCount: number): number {
  return Math.round(nodeDurationMs(stackCount) * STACK_BUDGET_FRACTION);
}

export function buildActTimeline(act: ReplayActAnalysis): ActTimeline {
  let cursor = 0;
  const entries: ActTimelineEntry[] = act.history.map((entry, idx) => {
    const stackCount = countStackItems(entry);
    const durationMs = nodeDurationMs(stackCount);
    const out: ActTimelineEntry = {
      step: idx + 1,
      startMs: cursor,
      durationMs,
      stackCount,
    };
    cursor += durationMs;
    return out;
  });
  return { actIndex: act.actIndex, entries, totalMs: cursor };
}

export function buildRunTimeline(
  acts: ReplayActAnalysis[],
): RunTimeline {
  const actTimelines = acts.map(buildActTimeline);
  const actOffsets: number[] = [];
  let cursor = 0;
  for (const at of actTimelines) {
    actOffsets.push(cursor);
    cursor += at.totalMs + ACT_TAIL_BUFFER_MS;
  }
  // Trim the trailing buffer so totalMs ends at the last node's end.
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
