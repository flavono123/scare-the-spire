import { usesDedicatedLastScene } from "@/lib/history-last-scene";
import {
  NODE_BASE_MS,
  actPositionFromGlobalMs,
  stepFromElapsed,
  type RunTimeline,
} from "@/lib/sts2-run-timeline";

/**
 * Map transit follows the selected playback rate. Dedicated last-scene
 * beats stay 1× wall-clock so loot / card-pick / choice screens remain
 * readable when the default rate is 2×.
 */
export function playbackSpeedMultiplier(
  runTimeline: RunTimeline,
  globalMs: number,
  rate: number,
): number {
  const { actIndex, actLocalMs } = actPositionFromGlobalMs(runTimeline, globalMs);
  const actTimeline = runTimeline.acts[actIndex];
  if (!actTimeline) return rate;
  const step = stepFromElapsed(actTimeline, actLocalMs);
  const entry = actTimeline.entries[step - 1];
  if (!entry || !usesDedicatedLastScene(entry.sceneKind)) return rate;
  const nodeLocal = actLocalMs - entry.startMs;
  if (nodeLocal < NODE_BASE_MS) return rate;
  return 1;
}
