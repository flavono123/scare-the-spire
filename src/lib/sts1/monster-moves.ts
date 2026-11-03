import type {
  Sts1Monster,
  Sts1MonsterAmount,
  Sts1MonsterHitPoints,
  Sts1MonsterIntent,
  Sts1MonsterMoveTier,
} from "./types";

/** STS1 ascension runs 0–20, kept apart from the STS2 bestiary's level. */
export const STS1_MONSTER_ASCENSION_SCOPE = {
  storageKey: "sts1.monsterAscensionLevel",
  event: "sts1:monster-ascension-level",
  maxLevel: 20,
};

/** The tier in effect at `level`: the last one that starts at or below it. */
export function tierAt<T extends { ascension: number }>(tiers: readonly T[], level: number): T | undefined {
  let current: T | undefined = tiers[0];
  for (const tier of tiers) {
    if (tier.ascension <= level) current = tier;
  }
  return current;
}

export function hitPointsAt(monster: Pick<Sts1Monster, "hitPoints">, level: number): Sts1MonsterHitPoints | undefined {
  return tierAt(monster.hitPoints, level);
}

export function formatSts1Amount(amount: Sts1MonsterAmount | null | undefined): string {
  if (amount == null) return "?";
  if (typeof amount === "number") return String(amount);
  return amount.min === amount.max ? String(amount.min) : `${amount.min}-${amount.max}`;
}

function amountFloor(amount: Sts1MonsterAmount | null | undefined): number | null {
  if (amount == null) return null;
  return typeof amount === "number" ? amount : amount.min;
}

const ATTACK_INTENTS = new Set<Sts1MonsterIntent>(["ATTACK", "ATTACK_BUFF", "ATTACK_DEBUFF", "ATTACK_DEFEND"]);

export function isSts1AttackIntent(intent: Sts1MonsterIntent | undefined): boolean {
  return Boolean(intent && ATTACK_INTENTS.has(intent));
}

/** AbstractMonster.getIntentImg(): attack art steps up every 5 total damage. */
export function sts1IntentImageName(tier: Pick<Sts1MonsterMoveTier, "intent" | "damage" | "multiplier">): string | null {
  const intent = tier.intent ?? "UNKNOWN";
  if (isSts1AttackIntent(intent)) {
    const total = (amountFloor(tier.damage) ?? 0) * (tier.multiplier ?? 1);
    const step = [5, 10, 15, 20, 25, 30].findIndex((limit) => total < limit);
    return `attack-${step < 0 ? 7 : step + 1}`;
  }
  switch (intent) {
    case "BUFF":
      return "buff";
    case "DEBUFF":
      return "debuff";
    case "STRONG_DEBUFF":
      return "strong-debuff";
    case "DEFEND":
    case "DEFEND_DEBUFF":
      return "defend";
    case "DEFEND_BUFF":
      return "defend-buff";
    case "ESCAPE":
      return "escape";
    case "MAGIC":
      return "magic";
    case "SLEEP":
      return "sleep";
    case "STUN":
      return "stun";
    default:
      return "unknown";
  }
}

/** The number the game prints on an attack intent: `11`, or `5x2` for multi-hits. */
export function sts1IntentDamageLabel(tier: Pick<Sts1MonsterMoveTier, "intent" | "damage" | "multiplier">): string | null {
  if (!isSts1AttackIntent(tier.intent)) return null;
  const damage = formatSts1Amount(tier.damage);
  return tier.multiplier && tier.multiplier > 1 ? `${damage}x${tier.multiplier}` : damage;
}

// -- whole-sprite motions (AbstractCreature.use*Animation) ----------------------

export interface Sts1MotionFrame {
  /** 0..1 through the motion. */
  offset: number;
  /** Skeleton units; x is negative toward the player. */
  x: number;
  y: number;
}

export interface Sts1Motion {
  durationMs: number;
  frames: Sts1MotionFrame[];
}

/** libGDX Interpolation.fade. */
function fade(a: number): number {
  return a * a * a * (a * (a * 6 - 15) + 10);
}

/** libGDX Interpolation.exp10In. */
function exp10In(a: number): number {
  const min = 2 ** -10;
  return (2 ** (10 * (a - 1)) - min) / (1 - min);
}

const ATTACK_REACH = 90;
const SAMPLE_STEPS = 24;

function sampled(durationMs: number, at: (seconds: number) => { x: number; y: number }): Sts1Motion {
  const frames: Sts1MotionFrame[] = [];
  for (let step = 0; step <= SAMPLE_STEPS; step += 1) {
    const offset = step / SAMPLE_STEPS;
    frames.push({ offset, ...at((offset * durationMs) / 1000) });
  }
  return { durationMs, frames };
}

/** Gravity of 17 units per 60 fps frame; ends on landing. */
function hop(initialSpeed: number): Sts1Motion {
  const heights = [0];
  let speed = initialSpeed;
  let height = 0;
  while (heights.length < 600) {
    speed -= 17;
    height += speed / 60;
    if (height < 0) break;
    heights.push(height);
  }
  heights.push(0);
  const durationMs = ((heights.length - 1) / 60) * 1000;
  return {
    durationMs,
    frames: heights.map((y, index) => ({ offset: index / (heights.length - 1), x: 0, y })),
  };
}

/** Back and forth at 150 units/s between ±8. */
function shake(seconds: number): Sts1Motion {
  return sampled(seconds * 1000, (time) => {
    const period = (8 * 4) / 150;
    const phase = (time % period) / period;
    const wave = phase < 0.25 ? phase * 4 : phase < 0.75 ? 2 - phase * 4 : phase * 4 - 4;
    return { x: time >= seconds ? 0 : wave * 8, y: 0 };
  });
}

export function sts1Motion(name: string): Sts1Motion | null {
  switch (name) {
    case "fast-attack":
      // Starts at 0.4 s of a 1 s clock, so it snaps out and fades back.
      return sampled(400, (time) => ({ x: -ATTACK_REACH * fade(2 * (0.4 - time)), y: 0 }));
    case "slow-attack":
      return sampled(1000, (time) => ({
        x: -ATTACK_REACH * (time < 0.5 ? exp10In(2 * time) : fade(2 * (1 - time))),
        y: 0,
      }));
    case "hop":
      return hop(300);
    case "jump":
      return hop(500);
    case "shake":
      return shake(1);
    default:
      return null;
  }
}
