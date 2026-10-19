/**
 * Turns engine steps into a fixed timeline so the scene is a pure function of
 * time: `frameAt(t)` always returns the same beat, progress and state for the
 * same input. Beat lengths follow what the game awaits (see beatDuration);
 * visual motion that the game does not await (card flights, VFX) runs on its
 * own clock in the scene.
 */

import type { CombatSimInput, SimEvent, SimResult, SimState } from "./types";

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

/** One rendered frame at 30 fps: the game moves on without awaiting the card's flight. */
const FRAME_MS = 1000 / 30;

/**
 * How long the game waits on each step (0.102.0 source):
 * - CardPileCmd.Add to the hand awaits a 0.25 s tween per card (draws are 0.25 s apart);
 * - the manual play move tweens to the play position in 0.25 s (Cubic Out);
 * - discards, the result pile and the end-of-turn discard hand the card to
 *   NCardFlyVfx and continue (about a frame), the flight plays on its own clock;
 * - an exhaust fades the card over 0.3 s; a reshuffle waits 0.5 s after the last card;
 * - energy changes are instant (NEnergyCounter only refreshes its label).
 * `select` is the simulator's stand-in for the player lifting the card (hover pose).
 */
export function beatDuration(event: SimEvent, action: number): number {
  if (action < 0) return 0; // setup is already in place at t = 0
  switch (event.kind) {
    case "select": return 300;
    case "move":
      switch (event.cause) {
        case "play": return 250;
        case "draw": return 250;
        case "discard": return FRAME_MS;
        case "result": return FRAME_MS;
        case "exhaust": return 300;
        case "shuffle": return 45;
        case "endTurn": return 0;
      }
      return FRAME_MS;
    case "energy": return 0;
    case "afflictionTrigger": return 0;
    case "animate": return 0;
    case "afflict": return 0;
    case "clearAffliction": return 0;
    case "enter": return 250;
    case "remove": return 400;
    case "power": return 400;
    case "damage": return 450;
    case "block": return 350;
    case "intent": return 300;
    case "shuffle": return 500;
    case "wait": return event.ms;
    case "unimplemented": return 0;
    case "rejected": return 800;
  }
}

export function buildTimeline(result: SimResult, input?: CombatSimInput): CombatTimeline {
  const beats: TimelineBeat[] = [];
  const scriptLength = input?.script?.length ?? 0;
  const actionEnds = Array.from({ length: scriptLength }, () => 0);
  let clock = 0;
  let before = result.initial;
  result.steps.forEach((step, index) => {
    const duration = beatDuration(step.event, step.action);
    beats.push({ start: clock, duration, step: index, action: step.action, event: step.event, before, after: step.state });
    clock += duration;
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
