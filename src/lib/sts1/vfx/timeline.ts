/**
 * Turns a move's extracted `takeTurn` timeline into live effects: argument
 * expressions are evaluated against the stage's monster, stand-in player and
 * screen at the moment each effect starts, and rolls are drawn then.
 */
import type { Sts1VfxArg, Sts1VfxNumber } from "../types";
import type { AbstractGameEffect } from "./effect";
import { Color } from "./gdx";
import type { Creature, Hitbox, VfxWorld } from "./world";
import { Settings } from "./world";
import { BiteEffect } from "./effects/bite-effect";
import { BloodShotEffect } from "./effects/blood-shot-effect";
import { BorderFlashEffect } from "./effects/border-flash-effect";
import { CleaveEffect } from "./effects/cleave-effect";
import { CollectorCurseEffect } from "./effects/collector-curse-effect";
import { EntangleEffect } from "./effects/entangle-effect";
import { FireballEffect } from "./effects/fireball-effect";
import { FlashAtkImgEffect } from "./effects/flash-atk-img-effect";
import { GhostIgniteEffect } from "./effects/ghost-ignite-effect";
import { GoldenSlashEffect } from "./effects/golden-slash-effect";
import { HeartBuffEffect } from "./effects/heart-buff-effect";
import { HeartMegaDebuffEffect } from "./effects/heart-mega-debuff-effect";
import { InflameEffect } from "./effects/inflame-effect";
import { IntenseZoomEffect } from "./effects/intense-zoom-effect";
import { IntimidateEffect } from "./effects/intimidate-effect";
import { LaserBeamEffect } from "./effects/laser-beam-effect";
import { ScreenOnFireEffect } from "./effects/screen-on-fire-effect";
import { ShockWaveEffect } from "./effects/shock-wave-effect";
import { SmallLaserEffect } from "./effects/small-laser-effect";
import { SmokeBombEffect } from "./effects/smoke-bomb-effect";
import { ViceCrushEffect } from "./effects/vice-crush-effect";
import { WebEffect } from "./effects/web-effect";
import { WeightyImpactEffect } from "./effects/weighty-impact-effect";

type EffectClass = new (...args: never[]) => AbstractGameEffect;

/** The effect classes monster turns queue, by their path under `vfx/`. */
const EFFECTS: Record<string, EffectClass> = {
  "combat.BiteEffect": BiteEffect,
  "combat.BloodShotEffect": BloodShotEffect,
  BorderFlashEffect,
  "combat.CleaveEffect": CleaveEffect,
  CollectorCurseEffect,
  "combat.EntangleEffect": EntangleEffect,
  "combat.FireballEffect": FireballEffect,
  "combat.FlashAtkImgEffect": FlashAtkImgEffect,
  "combat.GhostIgniteEffect": GhostIgniteEffect,
  "combat.GoldenSlashEffect": GoldenSlashEffect,
  "combat.HeartBuffEffect": HeartBuffEffect,
  "combat.HeartMegaDebuffEffect": HeartMegaDebuffEffect,
  "combat.InflameEffect": InflameEffect,
  "combat.IntenseZoomEffect": IntenseZoomEffect,
  "combat.IntimidateEffect": IntimidateEffect,
  "combat.LaserBeamEffect": LaserBeamEffect,
  "combat.ScreenOnFireEffect": ScreenOnFireEffect,
  "combat.ShockWaveEffect": ShockWaveEffect,
  "combat.SmallLaserEffect": SmallLaserEffect,
  "combat.SmokeBombEffect": SmokeBombEffect,
  "combat.ViceCrushEffect": ViceCrushEffect,
  "combat.WebEffect": WebEffect,
  "combat.WeightyImpactEffect": WeightyImpactEffect,
};

const NAMED_COLORS = Color as unknown as Record<string, Color | undefined>;
const SETTINGS_COLORS = Settings as unknown as Record<string, Color | undefined>;

function creatureField(creature: Creature, path: string[]): number {
  if (path[0] === "hb") {
    const key = path[1] as keyof Hitbox;
    return creature.hb[key] ?? 0;
  }
  const value = (creature as unknown as Record<string, unknown>)[path[0]];
  return typeof value === "number" ? value : 0;
}

function roll(name: string): number {
  // `rand3:-120.0:120.0` (float) or `randi2:0:2` (int, inclusive).
  const [kind, low, high] = name.split(":");
  const min = Number(low);
  const max = Number(high);
  if (kind.startsWith("randi")) return min + Math.floor(Math.random() * (max - min + 1));
  return min + Math.random() * (max - min);
}

function symbol(name: string, world: VfxWorld): number {
  if (name.startsWith("rand")) return roll(name);
  if (name === "screen.w") return world.width;
  if (name === "screen.h") return world.height;
  if (name === "floorY") return world.floorY;
  const [who, ...path] = name.split(".");
  if (who === "m") return creatureField(world.monster, path);
  if (who === "p") return creatureField(world.player, path);
  return 0;
}

export function evaluate(value: Sts1VfxNumber, world: VfxWorld): number {
  if (typeof value === "number") return value;
  let total = value.c;
  for (const [name, coeff] of Object.entries(value.t)) total += coeff * symbol(name, world);
  return total;
}

function color(spec: string | number | number[]): Color {
  if (Array.isArray(spec)) return new Color(spec[0], spec[1], spec[2], spec[3]);
  if (typeof spec === "number") return Color.fromRgba8888(spec);
  if (spec.startsWith("#")) return Color.valueOf(spec);
  if (spec.startsWith("Settings.")) return (SETTINGS_COLORS[spec.slice("Settings.".length)] ?? Color.WHITE).cpy();
  return (NAMED_COLORS[spec] ?? Color.WHITE).cpy();
}

function resolve(arg: Sts1VfxArg, world: VfxWorld): unknown {
  if (arg === null || typeof arg === "boolean" || typeof arg === "string" || typeof arg === "number") return arg;
  if ("c" in arg) return evaluate(arg, world);
  if ("color" in arg) return color(arg.color);
  if ("enum" in arg) return arg.enum;
  if ("creature" in arg) return arg.creature === "monster" ? world.monster : world.player;
  if ("hitbox" in arg) return arg.hitbox === "monster" ? world.monster.hb : world.player.hb;
  return null;
}

/** Builds the effect the game would have queued, or null for a class the site does not replay. */
export function createEffect(name: string, args: readonly Sts1VfxArg[], world: VfxWorld): AbstractGameEffect | null {
  const Effect = EFFECTS[name] as unknown as (new (...values: unknown[]) => AbstractGameEffect) | undefined;
  if (!Effect) return null;
  try {
    return new Effect(...args.map((arg) => resolve(arg, world)));
  } catch (error) {
    console.warn(`Failed to start STS1 effect ${name}:`, error);
    return null;
  }
}
