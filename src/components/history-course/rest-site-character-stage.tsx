"use client";

import { useEffect, useRef, useState } from "react";
import type { AnimationState, Skeleton, SpineCanvas } from "@esotericsoftware/spine-player";
import { loadSpinePlayerRuntime, type SpinePlayerRuntime } from "@/lib/spine-player-runtime";
import {
  restSiteCharacterAnimation,
  restSiteCharacterSpine,
} from "@/lib/history-last-scene-assets";
import { characterSlug } from "@/lib/history-party";

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
 * `rest_site_room.tscn` Character_1 sits on the left of the 1920×1080 camp.
 * `ironclad_rest_site.tscn` scales the Spine actor to 0.76.
 */
const CHARACTER_VISUAL = {
  x: 640,
  y: 980,
  scale: 0.76,
} as const;

type LoadState = "loading" | "ready" | "error";
type SpineLayer = { animationState: AnimationState; skeleton: Skeleton };

function prepareWebGl(canvas: HTMLCanvasElement): boolean {
  return Boolean(
    canvas.getContext("webgl2", WEBGL_CONFIG)
    ?? canvas.getContext("webgl", WEBGL_CONFIG),
  );
}

export function RestSiteCharacterStage({
  character,
  actId,
}: {
  character: string;
  actId: string;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const spine = restSiteCharacterSpine(characterSlug(character));
  const animation = restSiteCharacterAnimation(actId);

  /* eslint-disable react-hooks/set-state-in-effect -- Spine host remount resets load state with the canvas */
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const canvasElement = document.createElement("canvas");
    canvasElement.className = "absolute inset-0 h-full w-full";
    host.replaceChildren(canvasElement);
    setLoadState("loading");
    if (!prepareWebGl(canvasElement)) {
      setLoadState("error");
      return () => {
        canvasElement.remove();
      };
    }

    let disposed = false;
    let spineCanvas: SpineCanvas | null = null;
    let layers: SpineLayer[] = [];
    let frameAccumulator = TARGET_FRAME_SECONDS;
    let shouldRender = true;
    let renderedReducedMotionFrame = false;
    let isIntersecting = true;
    let isDocumentVisible = !document.hidden;
    let hasMarkedReady = false;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
              app.assetManager.loadBinary(spine.skelUrl);
              app.assetManager.loadTextureAtlas(spine.atlasUrl);
              if (spine.ostySkelUrl && spine.ostyAtlasUrl) {
                app.assetManager.loadBinary(spine.ostySkelUrl);
                app.assetManager.loadTextureAtlas(spine.ostyAtlasUrl);
              }
            },
            initialize: (app) => {
              if (disposed) return;
              try {
                layers = [
                  createActorLayer(runtime, app, {
                    atlasUrl: spine.atlasUrl,
                    binaryUrl: spine.skelUrl,
                    animation,
                    reducedMotion,
                    x: CHARACTER_VISUAL.x,
                    y: CHARACTER_VISUAL.y,
                    scale: CHARACTER_VISUAL.scale,
                  }),
                ];
                if (spine.ostySkelUrl && spine.ostyAtlasUrl) {
                  layers.push(createActorLayer(runtime, app, {
                    atlasUrl: spine.ostyAtlasUrl,
                    binaryUrl: spine.ostySkelUrl,
                    animation,
                    reducedMotion,
                    x: CHARACTER_VISUAL.x + 90,
                    y: CHARACTER_VISUAL.y,
                    scale: CHARACTER_VISUAL.scale * 0.55,
                  }));
                }
              } catch (error: unknown) {
                console.warn("Failed to initialize the rest-site character Spine scene:", error);
                setLoadState("error");
              }
            },
            update: (_app, delta) => {
              if (disposed || !isIntersecting || !isDocumentVisible || layers.length === 0) {
                shouldRender = false;
                return;
              }
              if (reducedMotion) {
                shouldRender = !renderedReducedMotionFrame;
                return;
              }
              frameAccumulator += Math.min(delta, 0.1);
              if (frameAccumulator < TARGET_FRAME_SECONDS) {
                shouldRender = false;
                return;
              }
              for (const layer of layers) {
                layer.skeleton.update(frameAccumulator);
                layer.animationState.update(frameAccumulator);
                layer.animationState.apply(layer.skeleton);
                layer.skeleton.updateWorldTransform(runtime.Physics.update);
              }
              frameAccumulator = 0;
              shouldRender = true;
            },
            render: (app) => {
              if (disposed || !shouldRender || layers.length === 0) return;
              renderActors(app, layers);
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
              console.warn("Failed to load the rest-site character Spine scene:", errors);
              setLoadState("error");
            },
            dispose: (app) => {
              app.assetManager.dispose();
            },
          },
        });
      })
      .catch((error: unknown) => {
        if (disposed) return;
        console.warn("Failed to load the rest-site character Spine runtime:", error);
        setLoadState("error");
      });

    return () => {
      disposed = true;
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      spineCanvas?.dispose();
      canvasElement.remove();
    };
  }, [animation, spine.atlasUrl, spine.ostyAtlasUrl, spine.ostySkelUrl, spine.skelUrl]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <div
      ref={hostRef}
      className="pointer-events-none absolute inset-0"
      data-history-rest-site-character={loadState}
      aria-hidden
    />
  );
}

function createActorLayer(
  runtime: SpinePlayerRuntime,
  app: SpineCanvas,
  config: {
    atlasUrl: string;
    binaryUrl: string;
    animation: string;
    reducedMotion: boolean;
    x: number;
    y: number;
    scale: number;
  },
): SpineLayer {
  const atlas = app.assetManager.require(config.atlasUrl);
  const binary = app.assetManager.require(config.binaryUrl);
  const skeletonLoader = new runtime.SkeletonBinary(new runtime.AtlasAttachmentLoader(atlas));
  const skeletonData = skeletonLoader.readSkeletonData(binary);
  const skeleton = new runtime.Skeleton(skeletonData);
  skeleton.setToSetupPose();
  skeleton.scaleX = config.scale;
  skeleton.scaleY = config.scale;
  skeleton.x = config.x;
  skeleton.y = GAME_VIEWPORT_HEIGHT - config.y;

  const animationState = new runtime.AnimationState(new runtime.AnimationStateData(skeletonData));
  const clip = skeletonData.findAnimation(config.animation)
    ?? skeletonData.findAnimation("overgrowth_loop")
    ?? skeletonData.animations[0];
  if (clip?.name) {
    const track = animationState.setAnimation(0, clip.name, true);
    if (config.reducedMotion) {
      track.trackTime = (track.animation?.duration ?? 0) * 0.35;
    }
  }
  animationState.apply(skeleton);
  skeleton.updateWorldTransform(runtime.Physics.update);
  return { animationState, skeleton };
}

function renderActors(app: SpineCanvas, layers: SpineLayer[]) {
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
  app.clear(0, 0, 0, 0);
  app.renderer.begin();
  for (const layer of layers) {
    app.renderer.drawSkeleton(layer.skeleton, false);
  }
  app.renderer.end();
}
