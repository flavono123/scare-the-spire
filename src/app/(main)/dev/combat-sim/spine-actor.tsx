"use client";

/**
 * A Spine actor drawn at an exact time. Unlike MonsterSpineStage (which
 * autoplays through SpinePlayer's rAF loop), this draws one pose per `t`
 * change: the pose is rebuilt from the cue list every time, so the same `t`
 * always gives the same pixels. Physics constraints are reset, not simulated.
 */

import { useEffect, useLayoutEffect, useRef } from "react";
import type { AnimationState, ManagedWebGLRenderingContext, SceneRenderer, Skeleton } from "@esotericsoftware/spine-player";
import type { MonsterSpineAsset } from "@/lib/codex-types";
import {
  createSpinePlainTextDownloader,
  loadSpinePlayerRuntime,
  type SpinePlayerRuntime,
} from "@/lib/spine-player-runtime";

export interface SpineCue {
  /** ms */
  t: number;
  animation: string;
}

export interface SpineViewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ActorStatus = "loading" | "ready" | "error";

interface SpineActorProps {
  id: string;
  asset: MonsterSpineAsset;
  /** Box size in stage pixels. */
  width: number;
  height: number;
  /** Device pixels per stage pixel. */
  pixelRatio: number;
  /** World rect to show; null fits the idle pose bounds (4% padding, like SpinePlayer). */
  viewport: SpineViewport | null;
  t: number;
  cues: SpineCue[];
  onStatus: (id: string, status: ActorStatus) => void;
}

interface Loaded {
  runtime: SpinePlayerRuntime;
  context: ManagedWebGLRenderingContext;
  renderer: SceneRenderer;
  skeleton: Skeleton;
  state: AnimationState;
  durations: Map<string, number>;
  viewport: SpineViewport;
  idle: string;
}

const CUE_MIX_IN = 0.12;
const CUE_MIX_OUT = 0.2;

export function SpineActor({ id, asset, width, height, pixelRatio, viewport, t, cues, onStatus }: SpineActorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loadedRef = useRef<Loaded | null>(null);
  const drawRef = useRef<() => void>(() => {});

  const drawNow = () => {
    const loaded = loadedRef.current;
    const canvas = canvasRef.current;
    if (!loaded || !canvas) return;
    poseAt(loaded, t, cues);
    render(loaded, canvas);
  };
  drawRef.current = drawNow;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    onStatus(id, "loading");
    loadSpinePlayerRuntime()
      .then((runtime) => load(runtime, canvas, asset, viewport))
      .then((loaded) => {
        if (disposed) return;
        loadedRef.current = loaded;
        drawRef.current();
        onStatus(id, "ready");
      })
      .catch((error: unknown) => {
        if (disposed) return;
        console.warn(`combat-sim: Spine ${asset.id} failed`, error);
        onStatus(id, "error");
      });
    return () => {
      disposed = true;
      const loaded = loadedRef.current;
      loadedRef.current = null;
      try {
        loaded?.context.gl.getExtension("WEBGL_lose_context")?.loseContext();
      } catch {
        // Best effort.
      }
    };
    // The viewport object is rebuilt each render; its numbers are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset.atlasUrl, asset.binaryUrl, id, viewport?.x, viewport?.y, viewport?.width, viewport?.height]);

  // Draw synchronously after every commit so a seek is on the canvas before paint.
  useLayoutEffect(() => {
    drawRef.current();
  });

  return (
    <canvas
      ref={canvasRef}
      width={Math.max(1, Math.round(width * pixelRatio))}
      height={Math.max(1, Math.round(height * pixelRatio))}
      style={{ width, height, display: "block" }}
    />
  );
}

async function load(runtime: SpinePlayerRuntime, canvas: HTMLCanvasElement, asset: MonsterSpineAsset, viewport: SpineViewport | null): Promise<Loaded> {
  const context = new runtime.ManagedWebGLRenderingContext(canvas, { alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true });
  const assets = new runtime.AssetManager(context, "", createSpinePlainTextDownloader(runtime));
  assets.loadBinary(asset.binaryUrl);
  assets.loadTextureAtlas(asset.atlasUrl);
  await new Promise<void>((resolve, reject) => {
    const tick = () => {
      if (assets.hasErrors()) {
        reject(new Error(JSON.stringify(assets.getErrors())));
        return;
      }
      if (assets.isLoadingComplete()) resolve();
      else window.setTimeout(tick, 16);
    };
    tick();
  });
  const atlas = assets.require(asset.atlasUrl);
  const binary = new runtime.SkeletonBinary(new runtime.AtlasAttachmentLoader(atlas));
  const data = binary.readSkeletonData(assets.require(asset.binaryUrl));
  const skeleton = new runtime.Skeleton(data);
  const skinNames = asset.defaultSkinCombination?.length ? asset.defaultSkinCombination : asset.skin ? [asset.skin] : [];
  if (skinNames.length > 0) {
    const skin = new runtime.Skin("combat-sim");
    for (const name of skinNames) {
      const part = data.findSkin(name);
      if (part) skin.addSkin(part);
    }
    skeleton.setSkin(skin);
  }
  skeleton.setToSetupPose();
  const state = new runtime.AnimationState(new runtime.AnimationStateData(data));
  const durations = new Map(data.animations.map((animation) => [animation.name, animation.duration]));
  const idle = durations.has(asset.idleAnimation) ? asset.idleAnimation : data.animations[0]?.name ?? "";
  const renderer = new runtime.SceneRenderer(canvas, context, true);
  const loaded: Loaded = { runtime, context, renderer, skeleton, state, durations, viewport: viewport ?? { x: 0, y: 0, width: 1, height: 1 }, idle };
  if (!viewport) {
    poseAt(loaded, 0, []);
    const offset = new runtime.Vector2();
    const size = new runtime.Vector2();
    skeleton.getBounds(offset, size, []);
    loaded.viewport = {
      x: offset.x - size.x * 0.04,
      y: offset.y - size.y * 0.04,
      width: size.x * 1.08,
      height: size.y * 1.08,
    };
  }
  return loaded;
}

interface Track {
  animation: string;
  /** seconds into the animation */
  time: number;
  loop: boolean;
}

function setTrack(loaded: Loaded, from: Track | null, to: Track, mix: number, elapsed: number) {
  const { state, skeleton } = loaded;
  state.clearTracks();
  skeleton.setToSetupPose();
  if (from) {
    const previous = state.setAnimation(0, from.animation, from.loop);
    previous.trackTime = from.time;
    // An entry that was never applied is replaced instead of mixed.
    state.apply(skeleton);
  }
  const entry = state.setAnimation(0, to.animation, to.loop);
  entry.trackTime = to.time;
  entry.mixDuration = from ? mix : 0;
  state.update(elapsed);
  state.apply(skeleton);
}

/** Idle loops on the global clock; each cue plays once from its time, then mixes back to idle. */
function poseAt(loaded: Loaded, tMs: number, cues: SpineCue[]) {
  const t = tMs / 1000;
  const playable = cues.filter((cue) => loaded.durations.has(cue.animation) && cue.t <= tMs);
  const cue = playable.at(-1);
  const idle = (time: number): Track => ({ animation: loaded.idle, time, loop: true });
  if (!cue) {
    setTrack(loaded, null, idle(t), 0, 0);
  } else {
    const start = cue.t / 1000;
    const duration = loaded.durations.get(cue.animation) ?? 0;
    if (t < start + duration) {
      const previous = playable.at(-2);
      const previousEnd = previous ? previous.t / 1000 + (loaded.durations.get(previous.animation) ?? 0) : -1;
      const from = previous && previousEnd > start
        ? { animation: previous.animation, time: start - previous.t / 1000, loop: false }
        : idle(start);
      setTrack(loaded, from, { animation: cue.animation, time: 0, loop: false }, CUE_MIX_IN, t - start);
    } else {
      const end = start + duration;
      setTrack(loaded, { animation: cue.animation, time: duration, loop: false }, idle(end), CUE_MIX_OUT, t - end);
    }
  }
  loaded.skeleton.updateWorldTransform(loaded.runtime.Physics.reset);
}

function render(loaded: Loaded, canvas: HTMLCanvasElement) {
  const { context, renderer, skeleton, viewport } = loaded;
  const gl = context.gl;
  const width = canvas.width;
  const height = canvas.height;
  gl.viewport(0, 0, width, height);
  renderer.camera.setViewport(width, height);
  const zoom = Math.max(viewport.width / width, viewport.height / height);
  renderer.camera.zoom = zoom;
  // Centered horizontally, feet (viewport bottom) on the canvas bottom.
  renderer.camera.position.x = viewport.x + viewport.width / 2;
  renderer.camera.position.y = viewport.y + (height * zoom) / 2;
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  renderer.begin();
  renderer.drawSkeleton(skeleton, false);
  renderer.end();
}
