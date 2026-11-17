"use client";

/**
 * A Spine skeleton placed like a Godot SpineSprite: its origin at (x, y) on the 1920x1080 game
 * screen with scale (sx, sy), drawn into a canvas that covers `box` (game px). The pose is rebuilt
 * from `t` on every draw (looping track, physics reset), so the same `t` gives the same pixels.
 */

import { useEffect, useLayoutEffect, useRef } from "react";
import type { AnimationState, ManagedWebGLRenderingContext, SceneRenderer, Skeleton } from "@esotericsoftware/spine-player";
import { createSpinePlainTextDownloader, loadSpinePlayerRuntime, type SpinePlayerRuntime } from "@/lib/spine-player-runtime";

export interface PlacedSpineAsset {
  atlasUrl: string;
  binaryUrl: string;
}

export interface SlotTransform {
  x: number;
  y: number;
  /** Degrees, clockwise on screen. */
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export type SpineStatus = "loading" | "ready" | "error";

interface PlacedSpineProps {
  id: string;
  asset: PlacedSpineAsset;
  animation: string;
  skin?: string | null;
  x: number;
  y: number;
  sx: number;
  sy: number;
  box: { x: number; y: number; width: number; height: number };
  /** Device pixels per game pixel. */
  pixelRatio: number;
  t: number;
  /** Local bone rotations (deg) set after the animation is applied, like MegaBone.SetRotation in _Process. */
  boneRotations?: Record<string, number>;
  /** Slots whose screen transform is reported after each draw (SpineSlotNode children). */
  trackSlots?: string[];
  onSlots?: (slots: Record<string, SlotTransform>) => void;
  onStatus: (id: string, status: SpineStatus) => void;
}

interface Loaded {
  runtime: SpinePlayerRuntime;
  context: ManagedWebGLRenderingContext;
  renderer: SceneRenderer;
  skeleton: Skeleton;
  state: AnimationState;
}

export function PlacedSpine(props: PlacedSpineProps) {
  const { id, asset, box, pixelRatio, onStatus } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loadedRef = useRef<Loaded | null>(null);
  const propsRef = useRef(props);

  const draw = () => {
    const loaded = loadedRef.current;
    const canvas = canvasRef.current;
    if (!loaded || !canvas) return;
    const p = propsRef.current;
    const { skeleton, state, renderer, context, runtime } = loaded;
    state.clearTracks();
    skeleton.setToSetupPose();
    const entry = state.setAnimation(0, p.animation, true);
    entry.trackTime = p.t / 1000;
    state.update(0);
    state.apply(skeleton);
    for (const [bone, rotation] of Object.entries(p.boneRotations ?? {})) {
      const found = skeleton.findBone(bone);
      if (found) found.rotation = rotation;
    }
    skeleton.scaleX = p.sx;
    skeleton.scaleY = p.sy;
    skeleton.updateWorldTransform(runtime.Physics.reset);
    const gl = context.gl;
    gl.viewport(0, 0, canvas.width, canvas.height);
    renderer.camera.setViewport(canvas.width, canvas.height);
    renderer.camera.zoom = 1 / p.pixelRatio;
    // World y is up; the screen's is down.
    renderer.camera.position.x = p.box.x + p.box.width / 2 - p.x;
    renderer.camera.position.y = p.y - (p.box.y + p.box.height / 2);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    renderer.begin();
    renderer.drawSkeleton(skeleton, false);
    renderer.end();
    if (p.trackSlots && p.onSlots) {
      const out: Record<string, SlotTransform> = {};
      for (const name of p.trackSlots) {
        const bone = skeleton.findSlot(name)?.bone;
        if (!bone) continue;
        out[name] = {
          x: p.x + bone.worldX,
          y: p.y - bone.worldY,
          rotation: -bone.getWorldRotationX(),
          scaleX: bone.getWorldScaleX(),
          scaleY: bone.getWorldScaleY(),
        };
      }
      p.onSlots(out);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    onStatus(id, "loading");
    loadSpinePlayerRuntime()
      .then(async (runtime) => {
        const context = new runtime.ManagedWebGLRenderingContext(canvas, { alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true });
        const assets = new runtime.AssetManager(context, "", createSpinePlainTextDownloader(runtime));
        assets.loadBinary(asset.binaryUrl);
        assets.loadTextureAtlas(asset.atlasUrl);
        await new Promise<void>((resolve, reject) => {
          const tick = () => {
            if (assets.hasErrors()) reject(new Error(JSON.stringify(assets.getErrors())));
            else if (assets.isLoadingComplete()) resolve();
            else window.setTimeout(tick, 16);
          };
          tick();
        });
        const data = new runtime.SkeletonBinary(new runtime.AtlasAttachmentLoader(assets.require(asset.atlasUrl))).readSkeletonData(assets.require(asset.binaryUrl));
        const skeleton = new runtime.Skeleton(data);
        const skin = propsRef.current.skin;
        if (skin && data.findSkin(skin)) skeleton.setSkinByName(skin);
        const state = new runtime.AnimationState(new runtime.AnimationStateData(data));
        if (!data.findAnimation(propsRef.current.animation)) throw new Error(`${id}: no animation ${propsRef.current.animation}`);
        return { runtime, context, renderer: new runtime.SceneRenderer(canvas, context, true), skeleton, state };
      })
      .then((loaded) => {
        if (disposed) return;
        loadedRef.current = loaded;
        draw();
        onStatus(id, "ready");
      })
      .catch((error: unknown) => {
        if (disposed) return;
        console.warn(`node-sim: Spine ${id} failed`, error);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset.atlasUrl, asset.binaryUrl, id]);

  // Draw synchronously after every commit so a seek is on the canvas before paint.
  useLayoutEffect(() => {
    propsRef.current = props;
    draw();
  });

  return (
    <canvas
      ref={canvasRef}
      width={Math.max(1, Math.round(box.width * pixelRatio))}
      height={Math.max(1, Math.round(box.height * pixelRatio))}
      style={{ position: "absolute", left: box.x, top: box.y, width: box.width, height: box.height }}
    />
  );
}
