"use client";

import { useEffect, useRef, useState } from "react";
import type { AnimationState, Skeleton, SpineCanvas } from "@esotericsoftware/spine-player";
import { loadSpinePlayerRuntime, type SpinePlayerRuntime } from "@/lib/spine-player-runtime";
import { treasureRoomSpineAct } from "@/lib/history-last-scene-assets";

const GAME_VIEWPORT_WIDTH = 1920;
const GAME_VIEWPORT_HEIGHT = 1080;
const TARGET_FRAME_SECONDS = 1 / 30;
const MAX_DEVICE_PIXEL_RATIO = 1.5;
const WEBGL_CONFIG: WebGLContextAttributes = {
  alpha: true,
  antialias: true,
  preserveDrawingBuffer: false,
};

/**
 * `scenes/rooms/treasure_room/chest.tscn` on a 1920×1080 Control:
 * Chest is center-anchored (offsets -358,-173,442,327) → top-left (602, 367).
 * ChestVisual SpineSprite is at (-604, -301) with scale 0.4.
 * Atlas extract is 0.5 only to stay under 4096; skeleton world units stay full-res.
 */
const CHEST_VISUAL = {
  x: 602 - 604,
  y: 367 - 301,
  scale: 0.4,
} as const;
const OPEN_ANIMATION = "animation";
const SHINE_ANIMATION = "shine_fade";

type LoadState = "loading" | "ready" | "error";

export function TreasureRoomStage({
  actId,
  open,
}: {
  actId: string;
  open: boolean;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const openRef = useRef(open);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const act = treasureRoomSpineAct(actId);
  /* eslint-disable react-hooks/refs -- Spine tick reads the latest chest-open flag */
  openRef.current = open;
  /* eslint-enable react-hooks/refs */

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const canvasElement = document.createElement("canvas");
    canvasElement.className = "absolute inset-0 h-full w-full";
    host.replaceChildren(canvasElement);
    setLoadState("loading");
    if (!prepareWebGl(canvasElement)) {
      console.warn("Treasure room canvas could not create a WebGL context");
      setLoadState("error");
      return () => {
        canvasElement.remove();
      };
    }

    let disposed = false;
    let spineCanvas: SpineCanvas | null = null;
    let layer: { animationState: AnimationState; skeleton: Skeleton } | null = null;
    let frameAccumulator = TARGET_FRAME_SECONDS;
    let shouldRender = true;
    let renderedReducedMotionFrame = false;
    let isIntersecting = true;
    let isDocumentVisible = !document.hidden;
    let hasMarkedReady = false;
    let hasStartedOpen = openRef.current;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const atlasUrl = `/spine/sts2/event-backgrounds/treasure_room/chest_room_act_${act}.atlas`;
    const binaryUrl = `/spine/sts2/event-backgrounds/treasure_room/chest_room_act_${act}.skel`;
    const skinName = `act${act}`;

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      isIntersecting = entry?.isIntersecting ?? true;
      if (isIntersecting) frameAccumulator = TARGET_FRAME_SECONDS;
    });
    intersectionObserver.observe(canvasElement);

    const handleVisibilityChange = () => {
      isDocumentVisible = !document.hidden;
      if (isDocumentVisible) frameAccumulator = TARGET_FRAME_SECONDS;
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    void loadSpinePlayerRuntime()
      .then((runtime) => {
        if (disposed) return;
        canvasElement.style.opacity = "1";
        spineCanvas = new runtime.SpineCanvas(canvasElement, {
          app: {
            loadAssets: (app) => {
              app.assetManager.loadBinary(binaryUrl);
              app.assetManager.loadTextureAtlas(atlasUrl);
            },
            initialize: (app) => {
              if (disposed) return;
              canvasElement.style.opacity = "1";
              try {
                layer = createChestLayer(runtime, app, {
                  atlasUrl,
                  binaryUrl,
                  skinName,
                  reducedMotion,
                  open: openRef.current,
                });
              } catch (error: unknown) {
                console.warn("Failed to initialize the treasure-room Spine scene:", error);
                setLoadState("error");
              }
            },
            update: (_app, delta) => {
              if (disposed || !isIntersecting || !isDocumentVisible || !layer) {
                shouldRender = false;
                return;
              }
              frameAccumulator += Math.min(delta, 0.1);
              if (frameAccumulator < TARGET_FRAME_SECONDS) {
                shouldRender = false;
                return;
              }
              if (reducedMotion) {
                shouldRender = !renderedReducedMotionFrame;
                poseChest(layer.animationState, layer.skeleton.data, {
                  open: openRef.current,
                  reducedMotion: true,
                });
                hasStartedOpen = openRef.current;
              } else if (!openRef.current) {
                hasStartedOpen = false;
                poseChest(layer.animationState, layer.skeleton.data, {
                  open: false,
                  reducedMotion: false,
                });
              } else if (!hasStartedOpen) {
                hasStartedOpen = true;
                poseChest(layer.animationState, layer.skeleton.data, {
                  open: true,
                  reducedMotion: false,
                });
                layer.skeleton.update(frameAccumulator);
                layer.animationState.update(frameAccumulator);
              } else {
                layer.skeleton.update(frameAccumulator);
                layer.animationState.update(frameAccumulator);
              }
              layer.animationState.apply(layer.skeleton);
              layer.skeleton.updateWorldTransform(runtime.Physics.update);
              frameAccumulator = 0;
              shouldRender = true;
            },
            render: (app) => {
              if (disposed || !shouldRender || !layer) return;
              renderChest(app, layer.skeleton);
              shouldRender = false;
              renderedReducedMotionFrame = reducedMotion;
              if (!hasMarkedReady) {
                hasMarkedReady = true;
                canvasElement.style.opacity = "1";
                setLoadState("ready");
              }
            },
            error: (_app, errors) => {
              if (disposed) return;
              console.warn("Failed to load the treasure-room Spine scene:", errors);
              setLoadState("error");
            },
            dispose: (app) => {
              app.assetManager.dispose();
              app.renderer.dispose();
              app.gl.getExtension("WEBGL_lose_context")?.loseContext();
            },
          },
        });
      })
      .catch((error: unknown) => {
        if (disposed) return;
        console.warn("Failed to load the Spine runtime for the treasure room:", error);
        setLoadState("error");
      });

    return () => {
      disposed = true;
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      spineCanvas?.dispose();
      spineCanvas = null;
      layer = null;
      canvasElement.remove();
    };
  }, [act]);

  return (
    <div
      ref={hostRef}
      className="pointer-events-none absolute inset-0 overflow-hidden bg-black"
      data-history-treasure-room={act}
      data-history-treasure-open={open ? "true" : "false"}
      data-history-treasure-load={loadState}
      aria-hidden
    />
  );
}

function prepareWebGl(canvas: HTMLCanvasElement) {
  return Boolean(
    canvas.getContext("webgl2")
    ?? canvas.getContext("webgl")
    ?? canvas.getContext("webgl2", WEBGL_CONFIG)
    ?? canvas.getContext("webgl", WEBGL_CONFIG),
  );
}

function poseChest(
  animationState: AnimationState,
  skeletonData: { findAnimation: (name: string) => { duration: number } | null },
  config: { open: boolean; reducedMotion: boolean },
) {
  animationState.clearTracks();
  animationState.setAnimation(0, OPEN_ANIMATION, false);
  const track = animationState.getCurrent(0);
  if (!track) return;
  if (!config.open) {
    track.trackTime = 0;
    return;
  }
  animationState.addAnimation(0, SHINE_ANIMATION, false, 0);
  if (config.reducedMotion) {
    const shine = skeletonData.findAnimation(SHINE_ANIMATION);
    const openClip = skeletonData.findAnimation(OPEN_ANIMATION);
    track.trackTime = (openClip?.duration ?? 0) + (shine?.duration ?? 0);
  }
}

function createChestLayer(
  runtime: SpinePlayerRuntime,
  app: SpineCanvas,
  config: {
    atlasUrl: string;
    binaryUrl: string;
    skinName: string;
    reducedMotion: boolean;
    open: boolean;
  },
) {
  const atlas = app.assetManager.require(config.atlasUrl);
  const binary = app.assetManager.require(config.binaryUrl);
  const skeletonLoader = new runtime.SkeletonBinary(new runtime.AtlasAttachmentLoader(atlas));
  const skeletonData = skeletonLoader.readSkeletonData(binary);
  const skeleton = new runtime.Skeleton(skeletonData);
  const skin =
    skeletonData.findSkin(config.skinName)
    ?? skeletonData.findSkin("default");
  if (skin) {
    skeleton.setSkin(skin);
    skeleton.setSlotsToSetupPose();
  }
  skeleton.setToSetupPose();
  skeleton.scaleX = CHEST_VISUAL.scale;
  skeleton.scaleY = CHEST_VISUAL.scale;
  skeleton.x = CHEST_VISUAL.x;
  skeleton.y = GAME_VIEWPORT_HEIGHT - CHEST_VISUAL.y;

  const animationState = new runtime.AnimationState(new runtime.AnimationStateData(skeletonData));
  poseChest(animationState, skeletonData, {
    open: config.open,
    reducedMotion: config.reducedMotion,
  });
  animationState.apply(skeleton);
  skeleton.updateWorldTransform(runtime.Physics.update);
  return { animationState, skeleton };
}

function renderChest(app: SpineCanvas, skeleton: Skeleton) {
  resizeCanvas(app);
  app.clear(0, 0, 0, 1);
  app.renderer.begin();
  app.renderer.drawSkeleton(skeleton, false);
  app.renderer.end();
}

function resizeCanvas(app: SpineCanvas) {
  const canvas = app.htmlCanvas;
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
  const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
  const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  app.gl.viewport(0, 0, width, height);
  app.renderer.camera.setViewport(GAME_VIEWPORT_WIDTH, GAME_VIEWPORT_HEIGHT);
  app.renderer.camera.position.x = GAME_VIEWPORT_WIDTH / 2;
  app.renderer.camera.position.y = GAME_VIEWPORT_HEIGHT / 2;
  app.renderer.camera.zoom = 1;
  app.renderer.camera.update();
}
