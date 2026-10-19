"use client";

/**
 * Canvas VFX ported from the game's scenes, drawn per time `t` (no running
 * particle state, so every frame is reproducible):
 * - Card trail (`scenes/vfx/card_trail_<character>.tscn`, NCardTrailVfx):
 *   two additive Line2D trails over the last 0.8 s of the flight with their
 *   width curves and gradients, two silhouette sprites (alpha 0 -> 1 over 1 s
 *   Cubic Out, scale -> 0.5 after 0.25 s over 0.5 s Cubic In), and the
 *   BigSparks / LittleSparks particles. FadeOut (u > 0.25 after arrival):
 *   alpha -> 0 over 0.5 s. The Line2D texture is applied as its cross profile.
 * - Energy gain (`*_energy_vfx_back/front.tscn`, restarted when energy rises):
 *   the common glow (grayscale texture as alpha, tinted) and the polar ring
 *   (polar-mapped texture with the erosion curve).
 * Particle randomness is seeded per flight / per gain.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { nextRandom, seedRandom } from "@/lib/combat-sim/rng";
import { flyParams, type CardVisual } from "./card-motion";
import { clamp01, ease, sampleCurve, sampleGradient, type CurvePoint, type GradientData } from "./godot-anim";
import { STAGE_H, STAGE_W, UI_SCALE } from "./stage-layout";

export interface TrailLine {
  modulate: number[];
  defaultColor: number[];
  width: number;
  widthCurve: CurvePoint[] | null;
  gradient: GradientData | null;
  texture: string | null;
}

export interface TrailParticles {
  amount: number;
  lifetime: number;
  lifetimeRandomness: number;
  emissionRect: number[];
  direction: number[];
  spread: number;
  gravity: number[];
  velocityMin: number;
  velocityMax: number;
  dampingMin: number;
  dampingMax: number;
  scaleMin: number;
  scaleMax: number;
  colorRamp: GradientData | null;
  texture: string | null;
}

export interface CardTrailAsset {
  scene: string;
  outer: TrailLine;
  inner: TrailLine;
  sprites: { modulate: number[]; scale: number[]; texture: string | null }[];
  bigSparks: TrailParticles | null;
  littleSparks: TrailParticles | null;
}

export interface EnergyGainLayer {
  kind: "glow" | "ring";
  side: "back" | "front";
  name: string;
  lifetime: number;
  modulate: number[];
  scaleMin: number;
  scaleCurve: CurvePoint[] | null;
  alphaCurve: CurvePoint[] | null;
  emissionCurve: CurvePoint[] | null;
  erosionCurve?: CurvePoint[] | null;
  erosionOffset?: number;
  texture: string | null;
}

export interface EnergyGainVfx {
  layers: EnergyGainLayer[];
  notExported: string[];
}

// ----------------------------------------------------------------- textures

const textureCache = new Map<string, Promise<HTMLImageElement>>();

function loadTexture(url: string): Promise<HTMLImageElement> {
  let promise = textureCache.get(url);
  if (!promise) {
    promise = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });
    textureCache.set(url, promise);
  }
  return promise;
}

function useTextures(urls: (string | null | undefined)[]): Map<string, HTMLImageElement> | null {
  const key = urls.filter(Boolean).join("|");
  const [textures, setTextures] = useState<Map<string, HTMLImageElement> | null>(null);
  useEffect(() => {
    let cancelled = false;
    const list = key ? key.split("|") : [];
    Promise.all(list.map(async (url) => [url, await loadTexture(url)] as const))
      .then((entries) => {
        if (!cancelled) setTextures(new Map(entries));
      })
      .catch(() => {
        if (!cancelled) setTextures(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [key]);
  return textures;
}

/** Texture alpha (or its red channel) as a white mask, tinted to `color`. Cached per color. */
const tintCache = new Map<string, HTMLCanvasElement>();

function tinted(image: HTMLImageElement, color: number[], useRed = false): HTMLCanvasElement {
  const key = `${image.src}|${useRed}|${color.map((value) => value.toFixed(2)).join(",")}`;
  const cached = tintCache.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d")!;
  context.drawImage(image, 0, 0);
  const data = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < data.data.length; i += 4) {
    const alpha = useRed ? (data.data[i] / 255) * (data.data[i + 3] / 255) : data.data[i + 3] / 255;
    data.data[i] = Math.round(Math.min(1, color[0]) * 255);
    data.data[i + 1] = Math.round(Math.min(1, color[1]) * 255);
    data.data[i + 2] = Math.round(Math.min(1, color[2]) * 255);
    data.data[i + 3] = Math.round(alpha * 255);
  }
  context.putImageData(data, 0, 0);
  if (tintCache.size > 400) tintCache.clear();
  tintCache.set(key, canvas);
  return canvas;
}

/** Alpha across a line texture's height (its v axis), sampled at 9 points. */
const profiles = new Map<string, number[]>();
function lineProfile(image: HTMLImageElement): number[] {
  let profile = profiles.get(image.src);
  if (!profile) {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    const column = Math.floor(image.naturalWidth / 2);
    profile = Array.from({ length: 9 }, (_, k) => {
      const y = Math.min(image.naturalHeight - 1, Math.round((k / 8) * (image.naturalHeight - 1)));
      const pixel = context.getImageData(column, y, 1, 1).data;
      return (pixel[3] / 255) * (pixel[0] / 255);
    });
    profiles.set(image.src, profile);
  }
  return profile;
}

function random(seed: number, index: number, salt: number): number {
  return nextRandom(seedRandom(seed * 7919 + index * 104729 + salt * 1299709))[0];
}

/** Quantize a color so the tint cache stays small. */
function quantize(color: number[]): number[] {
  return color.map((value) => Math.round(value * 16) / 16);
}

// ----------------------------------------------------------------- card trails

/** Seconds after arrival at which NCardTrailVfx.FadeOut starts (phase-2 u > 0.25). */
function fadeOutStart(seed: number): number {
  const params = flyParams(seed);
  const finalSpeed = params.speed + params.accel * params.arrival;
  return params.arrival + (0.25 * params.duration) / finalSpeed;
}

interface FlightRecord {
  uid: string;
  seed: number;
  /** Seconds since the flight began. */
  age: number;
  /** Flight position at an earlier age, for particle spawns. */
  positionAt: (age: number) => { x: number; y: number };
  visual: CardVisual;
}

function drawTrail(context: CanvasRenderingContext2D, trail: CardTrailAsset, flight: FlightRecord, textures: Map<string, HTMLImageElement>) {
  const fly = flight.visual.fly!;
  const fadeStart = fadeOutStart(flight.seed);
  const fade = flight.age > fadeStart ? 1 - clamp01((flight.age - fadeStart) / 0.5) : 1;
  if (fade <= 0) return;
  context.save();
  context.globalCompositeOperation = "lighter";

  // Line2D trails: points over the last 0.8 s, offset 0 = oldest (tail), 1 = head.
  // Drawn as one quad strip (no overlapping caps), shaded across its width by
  // the line texture's profile (texture_mode STRETCH: the texture is flat along the line).
  const points = fly.trail;
  for (const line of [trail.outer, trail.inner]) {
    if (points.length < 2) continue;
    const texture = line.texture ? textures.get(line.texture) : null;
    const profile = texture ? lineProfile(texture) : [0, 1, 0];
    const widths = points.map((_, i) => Math.max(0.5, line.width * sampleCurve(line.widthCurve, i / (points.length - 1), 1) * UI_SCALE));
    const normals = points.map((_, i) => {
      const a = points[Math.max(0, i - 1)];
      const b = points[Math.min(points.length - 1, i + 1)];
      const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      return { x: -(b.y - a.y) / length, y: (b.x - a.x) / length };
    });
    for (let i = 1; i < points.length; i += 1) {
      const f = (i - 0.5) / (points.length - 1);
      const color = sampleGradient(line.gradient, f).map((value, c) => value * (line.modulate[c] ?? 1));
      const alpha = (color[3] ?? 1) * fade;
      if (alpha <= 0.002) continue;
      const a = points[i - 1];
      const b = points[i];
      const na = normals[i - 1];
      const nb = normals[i];
      const wa = widths[i - 1] / 2;
      const wb = widths[i] / 2;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const nm = { x: (na.x + nb.x) / 2, y: (na.y + nb.y) / 2 };
      const half = (wa + wb) / 2;
      const gradient = context.createLinearGradient(mid.x - nm.x * half, mid.y - nm.y * half, mid.x + nm.x * half, mid.y + nm.y * half);
      const rgb = `${Math.round(clamp01(color[0]) * 255)}, ${Math.round(clamp01(color[1]) * 255)}, ${Math.round(clamp01(color[2]) * 255)}`;
      profile.forEach((value, k) => gradient.addColorStop(k / (profile.length - 1), `rgba(${rgb}, ${alpha * value})`));
      context.fillStyle = gradient;
      context.beginPath();
      context.moveTo(a.x + na.x * wa, a.y + na.y * wa);
      context.lineTo(b.x + nb.x * wb, b.y + nb.y * wb);
      context.lineTo(b.x - nb.x * wb, b.y - nb.y * wb);
      context.lineTo(a.x - na.x * wa, a.y - na.y * wa);
      context.closePath();
      context.fill();
    }
  }

  // Particles, emitted from the card while the trail lives (world space).
  for (const [salt, system] of [[1, trail.bigSparks], [2, trail.littleSparks]] as const) {
    if (!system?.texture) continue;
    const image = textures.get(system.texture);
    if (!image) continue;
    const rate = system.amount / system.lifetime;
    const emitUntil = Math.min(flight.age, fadeStart);
    const first = Math.max(0, Math.floor((flight.age - system.lifetime) * rate));
    const last = Math.floor(emitUntil * rate);
    const baseAngle = Math.atan2(system.direction[1], system.direction[0]);
    for (let index = first; index <= last; index += 1) {
      const spawn = index / rate;
      const life = system.lifetime * (1 - system.lifetimeRandomness * random(flight.seed, index, salt * 10 + 1));
      const age = flight.age - spawn;
      if (age < 0 || age >= life || life <= 0) continue;
      const origin = flight.positionAt(spawn);
      const ox = (random(flight.seed, index, salt * 10 + 2) * 2 - 1) * system.emissionRect[0] * UI_SCALE;
      const oy = (random(flight.seed, index, salt * 10 + 3) * 2 - 1) * system.emissionRect[1] * UI_SCALE;
      const angle = baseAngle + ((random(flight.seed, index, salt * 10 + 4) * 2 - 1) * system.spread * Math.PI) / 180;
      const speed = system.velocityMin + (system.velocityMax - system.velocityMin) * random(flight.seed, index, salt * 10 + 5);
      const damping = system.dampingMin + (system.dampingMax - system.dampingMin) * random(flight.seed, index, salt * 10 + 6);
      const stop = damping > 0 ? Math.min(age, speed / damping) : age;
      const travel = speed * stop - (damping * stop * stop) / 2;
      const x = origin.x + ox + (Math.cos(angle) * travel + (system.gravity[0] * age * age) / 2) * UI_SCALE;
      const y = origin.y + oy + (Math.sin(angle) * travel + (system.gravity[1] * age * age) / 2) * UI_SCALE;
      const color = quantize(sampleGradient(system.colorRamp, age / life));
      const alpha = (color[3] ?? 1) * fade;
      if (alpha <= 0.01) continue;
      const scale = (system.scaleMin + (system.scaleMax - system.scaleMin) * random(flight.seed, index, salt * 10 + 7)) * UI_SCALE;
      const rotation = random(flight.seed, index, salt * 10 + 8) * Math.PI * 2;
      const sprite = tinted(image, color);
      context.save();
      context.globalAlpha = alpha;
      context.translate(x, y);
      context.rotate(rotation);
      context.drawImage(sprite, (-image.naturalWidth * scale) / 2, (-image.naturalHeight * scale) / 2, image.naturalWidth * scale, image.naturalHeight * scale);
      context.restore();
    }
  }

  // Silhouette sprites at the card.
  const appear = ease.cubicOut(clamp01(flight.age / 1));
  const shrink = 1 - 0.5 * ease.cubicIn(clamp01((flight.age - 0.25) / 0.5));
  for (const sprite of trail.sprites) {
    const image = sprite.texture ? textures.get(sprite.texture) : null;
    if (!image) continue;
    const width = image.naturalWidth * sprite.scale[0] * shrink * UI_SCALE;
    const height = image.naturalHeight * sprite.scale[1] * shrink * UI_SCALE;
    context.save();
    context.globalAlpha = (sprite.modulate[3] ?? 1) * appear * fade;
    context.translate(fly.x, fly.y);
    context.rotate((fly.rotate * Math.PI) / 180);
    context.drawImage(tinted(image, sprite.modulate), -width / 2, -height / 2, width, height);
    context.restore();
  }
  context.restore();
}

export interface FlightInput {
  visual: CardVisual;
  seed: number;
  positionAt: (age: number) => { x: number; y: number };
}

export function CardTrailLayer({ flights, trail, pixelRatio }: { flights: FlightInput[]; trail: CardTrailAsset | null; pixelRatio: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textures = useTextures(
    trail ? [trail.outer.texture, trail.inner.texture, trail.bigSparks?.texture, trail.littleSparks?.texture, ...trail.sprites.map((sprite) => sprite.texture)] : [],
  );
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!trail || !textures) return;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    for (const flight of flights) {
      if (!flight.visual.fly) continue;
      drawTrail(context, trail, { uid: flight.visual.uid, seed: flight.seed, age: flight.visual.fly.age, positionAt: flight.positionAt, visual: flight.visual }, textures);
    }
  });
  return (
    <canvas
      ref={canvasRef}
      width={Math.round(STAGE_W * pixelRatio)}
      height={Math.round(STAGE_H * pixelRatio)}
      className="pointer-events-none absolute left-0 top-0"
      style={{ width: STAGE_W, height: STAGE_H, zIndex: 450 }}
      data-combat-sim-trails=""
    />
  );
}

// ----------------------------------------------------------------- energy gain

const RING_RES = 160;

function drawRing(context: CanvasRenderingContext2D, image: HTMLImageElement, layer: EnergyGainLayer, life: number, size: number) {
  const source = ringSource(image);
  const erosion = sampleCurve(layer.erosionCurve ?? null, life, 0.5);
  const offset = layer.erosionOffset ?? 0.1;
  const emission = sampleCurve(layer.emissionCurve, life, 1);
  const color = layer.modulate.map((value, i) => (i < 3 ? Math.min(1, value * emission) : value));
  const buffer = document.createElement("canvas");
  buffer.width = RING_RES;
  buffer.height = RING_RES;
  const bufferContext = buffer.getContext("2d")!;
  const output = bufferContext.createImageData(RING_RES, RING_RES);
  for (let j = 0; j < RING_RES; j += 1) {
    for (let i = 0; i < RING_RES; i += 1) {
      const dx = (i + 0.5) / RING_RES - 0.5;
      const dy = (j + 0.5) / RING_RES - 0.5;
      const radius = 2 * Math.hypot(dx, dy);
      if (radius >= 1) continue;
      // polar_uv: x = radius, y = atan(delta.x, delta.y) / 6.28
      let angle = Math.atan2(dx, dy) / 6.28;
      angle -= Math.floor(angle);
      const sx = Math.min(source.width - 1, Math.floor(radius * source.width));
      const sy = Math.min(source.height - 1, Math.floor(angle * source.height));
      const red = source.data[(sy * source.width + sx) * 4] / 255;
      const t = clamp01((red - erosion) / offset);
      const value = t * t * (3 - 2 * t);
      const alpha = (color[3] ?? 1) * value;
      if (alpha <= 0) continue;
      const index = (j * RING_RES + i) * 4;
      output.data[index] = Math.round(color[0] * 255);
      output.data[index + 1] = Math.round(color[1] * 255);
      output.data[index + 2] = Math.round(color[2] * 255);
      output.data[index + 3] = Math.round(alpha * 255);
    }
  }
  bufferContext.putImageData(output, 0, 0);
  context.drawImage(buffer, -size / 2, -size / 2, size, size);
}

const ringSources = new Map<string, ImageData>();
function ringSource(image: HTMLImageElement): ImageData {
  let data = ringSources.get(image.src);
  if (!data) {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    data = context.getImageData(0, 0, canvas.width, canvas.height);
    ringSources.set(image.src, data);
  }
  return data;
}

/** Glow behind the orb layers or ring in front of them, for every energy gain at or before `t`. */
export function EnergyGainLayerCanvas({ vfx, side, gains, t, size, pixelRatio }: {
  vfx: EnergyGainVfx | null;
  side: "back" | "front";
  /** Gain start times, ms. */
  gains: number[];
  t: number;
  /** Canvas box in stage px, centered on the orb. */
  size: number;
  pixelRatio: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layers = (vfx?.layers ?? []).filter((layer) => layer.side === side);
  const textures = useTextures(layers.map((layer) => layer.texture));
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!textures) return;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, (size / 2) * pixelRatio, (size / 2) * pixelRatio);
    for (const start of gains) {
      const age = (t - start) / 1000;
      if (age < 0) continue;
      for (const layer of layers) {
        if (age >= layer.lifetime || !layer.texture) continue;
        const image = textures.get(layer.texture);
        if (!image) continue;
        const life = age / layer.lifetime;
        const scale = layer.scaleMin * sampleCurve(layer.scaleCurve, life, 1) * UI_SCALE;
        const drawSize = image.naturalWidth * scale;
        if (layer.kind === "glow") {
          // vfx_grayscale_particle_shader: color = modulate, alpha = vertex alpha * texture red.
          context.save();
          context.globalAlpha = sampleCurve(layer.alphaCurve, life, 1) * (layer.modulate[3] ?? 1);
          context.drawImage(tinted(image, layer.modulate, true), -drawSize / 2, -drawSize / 2, drawSize, drawSize);
          context.restore();
        } else {
          drawRing(context, image, layer, life, drawSize);
        }
      }
    }
  });
  return (
    <canvas
      ref={canvasRef}
      width={Math.round(size * pixelRatio)}
      height={Math.round(size * pixelRatio)}
      className="pointer-events-none absolute"
      style={{ width: size, height: size }}
    />
  );
}

/** Hidden images so window.__sim.ready() waits for the VFX textures too. */
export function PreloadImages({ urls }: { urls: (string | null | undefined)[] }) {
  return (
    <div aria-hidden style={{ display: "none" }}>
      {[...new Set(urls.filter(Boolean))].map((url) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={url} src={url!} alt="" />
      ))}
    </div>
  );
}
