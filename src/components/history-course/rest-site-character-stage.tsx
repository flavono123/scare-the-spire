"use client";

import { useEffect, useRef, useState } from "react";
import type { AnimationState, Skeleton, SpineCanvas } from "@esotericsoftware/spine-player";
import { loadSpinePlayerRuntime, type SpinePlayerRuntime } from "@/lib/spine-player-runtime";
import { characterCombatArtSrc, characterSlug } from "@/lib/history-party";

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
 * `scenes/rooms/rest_site_room.tscn` Character_1 is a center-anchored Control
 * on a near-zero BgContainer at (651, 716). The character scene is 0.76 and
 * the Control is 0.5 → world scale 0.38. Node2D offset (-2, 42).
 */
const CHARACTER_VISUAL = {
  x: 650,
  y: 737,
  scale: 0.38,
} as const;

type LoadState = "loading" | "ready" | "error";

export function RestSiteCharacterStage({
  character,
  actId,
  atlasUrl,
  binaryUrl,
  idleName,
  fallbackUrl,
}: {
  character: string;
  actId: string;
  atlasUrl: string;
  binaryUrl: string;
  idleName: string;
  fallbackUrl: string;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  void actId;

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
    let layer: { animationState: AnimationState; skeleton: Skeleton } | null = null;
    let frameAccumulator = TARGET_FRAME_SECONDS;
    let shouldRender = true;
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
              app.assetManager.loadBinary(binaryUrl);
              app.assetManager.loadTextureAtlas(atlasUrl);
            },
            initialize: (app) => {
              if (disposed) return;
              try {
                layer = createCharacterLayer(runtime, app, {
                  atlasUrl,
                  binaryUrl,
                  idleName,
                  reducedMotion,
                });
              } catch (error: unknown) {
                console.warn("Failed to initialize the rest-site character Spine scene:", error);
                setLoadState("error");
              }
            },
            update: (_app, delta) => {
              if (disposed || !isIntersecting || !isDocumentVisible || !layer) {
                shouldRender = false;
                return;
              }
              if (reducedMotion) {
                shouldRender = true;
                return;
              }
              frameAccumulator += Math.min(delta, 0.1);
              if (frameAccumulator < TARGET_FRAME_SECONDS) {
                shouldRender = false;
                return;
              }
              layer.skeleton.update(frameAccumulator);
              layer.animationState.update(frameAccumulator);
              layer.animationState.apply(layer.skeleton);
              layer.skeleton.updateWorldTransform(runtime.Physics.update);
              frameAccumulator = 0;
              shouldRender = true;
            },
            render: (app) => {
              if (disposed || !shouldRender || !layer) return;
              renderCharacter(app, layer.skeleton);
              shouldRender = false;
              if (!hasMarkedReady) {
                hasMarkedReady = true;
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
              app.renderer.dispose();
              app.gl.getExtension("WEBGL_lose_context")?.loseContext();
            },
          },
        });
      })
      .catch((error: unknown) => {
        if (disposed) return;
        console.warn("Failed to load the Spine runtime for the rest-site character:", error);
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
  }, [atlasUrl, binaryUrl, idleName]);

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      data-history-rest-character={characterSlug(character)}
      data-history-rest-character-load={loadState}
      aria-hidden
    >
      <div ref={hostRef} className="absolute inset-0" />
      {loadState !== "ready" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fallbackUrl || characterCombatArtSrc(character)}
          alt=""
          className="absolute left-[33.9%] top-[66.3%] h-[42%] w-[18%] -translate-x-1/2 -translate-y-[82%] object-contain object-bottom drop-shadow-[0_12px_18px_rgba(0,0,0,0.65)]"
        />
      ) : null}
    </div>
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

function createCharacterLayer(
  runtime: SpinePlayerRuntime,
  app: SpineCanvas,
  config: {
    atlasUrl: string;
    binaryUrl: string;
    idleName: string;
    reducedMotion: boolean;
  },
) {
  const atlas = app.assetManager.require(config.atlasUrl);
  const binary = app.assetManager.require(config.binaryUrl);
  const skeletonLoader = new runtime.SkeletonBinary(new runtime.AtlasAttachmentLoader(atlas));
  const skeletonData = skeletonLoader.readSkeletonData(binary);
  const skeleton = new runtime.Skeleton(skeletonData);
  const skin = skeletonData.findSkin("Default") ?? skeletonData.findSkin("default");
  if (skin) {
    skeleton.setSkin(skin);
    skeleton.setSlotsToSetupPose();
  }
  skeleton.setToSetupPose();
  skeleton.scaleX = CHARACTER_VISUAL.scale;
  skeleton.scaleY = CHARACTER_VISUAL.scale;
  skeleton.x = CHARACTER_VISUAL.x;
  skeleton.y = GAME_VIEWPORT_HEIGHT - CHARACTER_VISUAL.y;

  const animationState = new runtime.AnimationState(new runtime.AnimationStateData(skeletonData));
  const idle =
    skeletonData.findAnimation(config.idleName)
    ?? skeletonData.findAnimation("overgrowth_loop")
    ?? skeletonData.animations[0];
  if (idle) {
    const track = animationState.setAnimation(0, idle.name, !config.reducedMotion);
    if (config.reducedMotion) {
      track.trackTime = 0;
    }
  }
  animationState.apply(skeleton);
  skeleton.updateWorldTransform(runtime.Physics.update);
  return { animationState, skeleton };
}

function renderCharacter(app: SpineCanvas, skeleton: Skeleton) {
  resizeCanvas(app);
  app.clear(0, 0, 0, 0);
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