"use client";

/**
 * The Weighted affliction overlay. The game draws it with
 * `shaders/afflictions/devoured.gdshader` on a 300x422 ColorRect
 * (`scenes/cards/overlays/afflictions/weighted.tscn`); the site has no
 * extracted texture for it, so this is a CPU port of that shader with
 * Weighted's uniforms, drawn at a third of the card size and scaled up.
 * Time is the simulator clock, so a frame is the same on every run.
 */

import { createContext, useContext, useLayoutEffect, useRef } from "react";

/** Simulator time (ms) for overlays rendered inside memoized card tiles. */
export const SimClock = createContext(0);

// weighted.tscn ShaderMaterial_devoured
const EDGE_INTENSITY = 0.8;
const PULSE_SPEED = 1.43600006495012;
const VOID_WIDTH = 0.175;
const NOISE_SCALE = 5.0;
const VOID_STRETCH = 3.0;
const VOID_COLOR = [0.68235296, 0.21960784, 0.12156863];
const VOID_EDGE_COLOR = [0.7137255, 0.019607844, 0.24313726];
const CORNER_RADIUS = 0.055;

const RES_W = 100;
const RES_H = 141;

function fract(x: number) {
  return x - Math.floor(x);
}

function hash(px: number, py: number) {
  let x = fract(px * 0.1031);
  let y = fract(py * 0.1031);
  let z = fract(px * 0.1031);
  const d = x * (y + 33.33) + y * (z + 33.33) + z * (x + 33.33);
  x += d;
  y += d;
  z += d;
  return fract((x + y) * z);
}

function valueNoise(px: number, py: number) {
  const ix = Math.floor(px);
  const iy = Math.floor(py);
  let fx = px - ix;
  let fy = py - iy;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  const top = a + (b - a) * fx;
  const bottom = c + (d - c) * fx;
  return top + (bottom - top) * fy;
}

function fbm(px: number, py: number) {
  let value = 0;
  let amplitude = 0.5;
  let x = px;
  let y = py;
  for (let i = 0; i < 4; i += 1) {
    value += amplitude * valueNoise(x, y);
    x *= 2.1;
    y *= 2.1;
    amplitude *= 0.5;
  }
  return value;
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function roundedRectSdf(px: number, py: number, half: number, radius: number) {
  const dx = Math.abs(px) - half + radius;
  const dy = Math.abs(py) - half + radius;
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  return outside + Math.min(Math.max(dx, dy), 0) - radius;
}

export function drawWeighted(context: CanvasRenderingContext2D, timeSeconds: number) {
  const image = context.createImageData(RES_W, RES_H);
  const data = image.data;
  const t = timeSeconds * PULSE_SPEED;
  for (let j = 0; j < RES_H; j += 1) {
    const v = (j + 0.5) / RES_H;
    for (let i = 0; i < RES_W; i += 1) {
      const u = (i + 0.5) / RES_W;
      const sdf = roundedRectSdf(u - 0.5, v - 0.5, 0.5, CORNER_RADIUS);
      const cardMask = 1 - smoothstep(-0.003, 0, sdf);
      const edgeDist = Math.max(-sdf, 0);
      const distH = Math.min(v, 1 - v);
      const distV = Math.min(u, 1 - u);
      const edgeBlend = smoothstep(0, 0.05, distH - distV);
      const stretchX = VOID_STRETCH + (1 - VOID_STRETCH) * edgeBlend;
      const stretchY = 1 + (VOID_STRETCH - 1) * edgeBlend;
      const noiseX = u * NOISE_SCALE * stretchX;
      const noiseY = v * NOISE_SCALE * stretchY;
      const warpX = (Math.sin(t * 0.7 + v * 4) * 0.4 + Math.cos(t * 0.5 + u * 3) * 0.3) * stretchX;
      const warpY = (Math.cos(t * 0.6 + u * 4) * 0.4 + Math.sin(t * 0.4 + v * 3) * 0.3) * stretchY;
      const n1 = fbm(noiseX + warpX, noiseY + warpY);
      const n2 = fbm(noiseX * 1.4 + warpX * 0.7 + 5, noiseY * 1.4 + warpY * 0.7 + 5);
      const combined = n1 + (n2 - n1) * 0.45;
      const reach = VOID_WIDTH + combined * 0.18;
      let voidMask = smoothstep(reach, 0, edgeDist);
      voidMask = smoothstep(0.1, 0.6, voidMask);
      voidMask *= 0.8 + 0.2 * Math.sin(t * 1.3 + combined * 3);
      const edgeColorBlend = smoothstep(0.08, 0, edgeDist);
      let r = VOID_EDGE_COLOR[0] + (VOID_COLOR[0] - VOID_EDGE_COLOR[0]) * edgeColorBlend;
      let g = VOID_EDGE_COLOR[1] + (VOID_COLOR[1] - VOID_EDGE_COLOR[1]) * edgeColorBlend;
      let b = VOID_EDGE_COLOR[2] + (VOID_COLOR[2] - VOID_EDGE_COLOR[2]) * edgeColorBlend;
      const speck = (valueNoise(noiseX * 3.5 + warpX * 2, noiseY * 3.5 + warpY * 2) >= 0.9 ? 1 : 0) * voidMask * 0.35;
      r += 0.3 * speck;
      g += 0.1 * speck;
      b += 0.5 * speck;
      const alpha = Math.min(1, voidMask * EDGE_INTENSITY * cardMask);
      const index = (j * RES_W + i) * 4;
      data[index] = Math.min(255, r * 255);
      data[index + 1] = Math.min(255, g * 255);
      data[index + 2] = Math.min(255, b * 255);
      data[index + 3] = alpha * 255;
    }
  }
  context.putImageData(image, 0, 0);
}

/**
 * Pass as CardTile's `afflictionOverlay`: the tile draws it in card.tscn's
 * OverlayContainer slot, so the void covers the frame and the description box
 * edges but not the title banner, type plaque or cost.
 */
export function WeightedOverlay() {
  const t = useContext(SimClock);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const context = canvasRef.current?.getContext("2d");
    if (context) drawWeighted(context, t / 1000);
  }, [t]);
  return (
    <canvas
      ref={canvasRef}
      width={RES_W}
      height={RES_H}
      data-combat-sim-weighted=""
      className="pointer-events-none absolute inset-0 z-[3] h-full w-full"
    />
  );
}
