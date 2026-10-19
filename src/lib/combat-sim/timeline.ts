/**
 * Turns engine steps into a fixed timeline so the scene is a pure function of
 * time: `frameAt(t)` always returns the same beat, progress and state for the
 * same input. Beat lengths follow what the game awaits (see beatDuration);
 * visual motion that the game does not await (card flights, VFX) runs on its
 * own clock in the scene.
 */

import type { CombatSimInput, SimEvent, SimResult, SimSpeed, SimState } from "./types";

export interface TimelineBeat {
  start: number;
  duration: number;
  /** Index into `result.steps`. */
  step: number;
  action: number;
  event: SimEvent;
  before: SimState;
  after: SimState;
}

export interface TimelineFrame {
  t: number;
  /** The beat playing at `t`, or the last finished one. Null before the first beat. */
  beat: TimelineBeat | null;
  /** 0..1 linear progress through `beat`. */
  progress: number;
  /** State after every beat that finished by `t`. */
  state: SimState;
}

export interface CombatTimeline {
  duration: number;
  beats: TimelineBeat[];
  /** Time each script action finishes, in script order. */
  actionEnds: number[];
  frameAt(t: number): TimelineFrame;
  /** Beats that started at or before `t`, newest last. */
  beatsUntil(t: number): TimelineBeat[];
}

/** One game frame at 60 fps: a tween with only callbacks finishes on the next frame. */
const FRAME_MS = 1000 / 60;

/** Cmd.CustomScaledWait(fast, standard): Fast waits `fast`, Normal `standard`, Instant does not wait. */
export function scaledWait(fastMs: number, normalMs: number, speed: SimSpeed): number {
  if (speed === "instant") return 0;
  return Math.max(0, speed === "fast" ? fastMs : normalMs);
}

/** CardPileCmd.AppendPileLerpTween duration: Instant 0.01 s, Fast 0.1 s, otherwise 0.25 s. */
export function pileLerpMs(speed: SimSpeed): number {
  return speed === "instant" ? 10 : speed === "fast" ? 100 : 250;
}

/** CreatureCmd.TriggerAnim: CustomScaledWait(min(delay * 0.5, 0.25), delay). */
export function animWaitMs(delayMs: number, speed: SimSpeed): number {
  return scaledWait(Math.min(delayMs * 0.5, 250), delayMs, speed);
}

/**
 * How long the game waits on each step, per speed (0.102.0 source):
 * - draws await AppendPileLerpTween (0.25 / 0.1 / 0.01 s);
 * - the manual play move (AddDuringManualCardPlay) awaits its tween only for
 *   Power cards (the scale tween is 0.25 s in every mode); other cards start
 *   their effect while the card is still flying to the play position;
 * - discards, the result pile and the end-of-turn discard hand the card to
 *   NCardFlyVfx and continue (about a frame) in every mode;
 * - an exhaust awaits the fade, `Fast ? 0.2 : 0.3` (Instant keeps 0.3);
 * - `pause` events are Cmd.CustomScaledWait(fast, normal); `animate` is TriggerAnim;
 * - energy, damage, block and power changes are instant, their waits are the pauses after them.
 * `select` is the simulator's stand-in for the player lifting the card (player
 * input, 0.3 s in every mode); script waits and rejected tags are not game waits.
 */
export function beatDuration(event: SimEvent, action: number, speed: SimSpeed = "normal"): number {
  if (action < 0) return 0; // setup is already in place at t = 0
  switch (event.kind) {
    case "select": return 300;
    case "move":
      switch (event.cause) {
        case "play": return event.awaited ? 250 : 0;
        case "draw": return pileLerpMs(speed);
        case "discard": return FRAME_MS;
        case "result": return FRAME_MS;
        case "exhaust": return speed === "fast" ? 200 : 300;
        // NCardFlyShuffleVfx stagger min(0.045, 0.8 / N); not checked per mode, normal value kept.
        case "shuffle": return 45;
        case "endTurn": return 0;
      }
      return FRAME_MS;
    case "pause": return scaledWait(event.fastMs, event.normalMs, speed);
    case "animate": return event.animation === "hurt" ? 0 : animWaitMs(event.delayMs, speed);
    case "enter": return pileLerpMs(speed);
    // PlayPowerCardFlyVfx: not simulated per mode, normal value kept.
    case "remove": return 400;
    // CardPileCmd.Shuffle ends with CustomScaledWait(0.2, 0.5).
    case "shuffle": return scaledWait(200, 500, speed);
    case "wait": return event.ms;
    case "rejected": return 800;
    case "energy":
    case "afflictionTrigger":
    case "afflict":
    case "clearAffliction":
    case "power":
    case "damage":
    case "block":
    case "intent":
    case "unimplemented":
      return 0;
  }
}

export function buildTimeline(result: SimResult, input?: CombatSimInput): CombatTimeline {
  const beats: TimelineBeat[] = [];
  const speed = input?.speed ?? "normal";
  const scriptLength = input?.script?.length ?? 0;
  const actionEnds = Array.from({ length: scriptLength }, () => 0);
  const stepEnds: number[] = [];
  let clock = 0;
  let before = result.initial;
  result.steps.forEach((step, index) => {
    let duration = beatDuration(step.event, step.action, speed);
    if (step.event.kind === "pause" && step.event.sincePlayMove !== undefined) {
      // OnPlayWrapper's wait counts from when the card reached the play pile.
      duration = Math.max(0, duration - (clock - (stepEnds[step.event.sincePlayMove] ?? clock)));
    }
    beats.push({ start: clock, duration, step: index, action: step.action, event: step.event, before, after: step.state });
    clock += duration;
    stepEnds[index] = clock;
    before = step.state;
    if (step.action >= 0) actionEnds[step.action] = clock;
  });
  // An action with no steps (none today) ends where the previous one did.
  for (let i = 0; i < actionEnds.length; i += 1) {
    if (actionEnds[i] === 0 && i > 0) actionEnds[i] = actionEnds[i - 1];
  }
  const duration = clock;

  const frameAt = (t: number): TimelineFrame => {
    const time = Math.max(0, Math.min(t, duration));
    // Last beat that started at or before `time`; zero-length beats at `time` count as done.
    let low = 0;
    let high = beats.length - 1;
    let found = -1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (beats[mid].start <= time) {
        found = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    if (found < 0) return { t: time, beat: null, progress: 0, state: result.start };
    const beat = beats[found];
    const progress = beat.duration === 0 ? 1 : Math.min(1, (time - beat.start) / beat.duration);
    return { t: time, beat, progress, state: progress >= 1 ? beat.after : beat.before };
  };

  const beatsUntil = (t: number) => beats.filter((beat) => beat.start <= t);

  return { duration, beats, actionEnds, frameAt, beatsUntil };
}
