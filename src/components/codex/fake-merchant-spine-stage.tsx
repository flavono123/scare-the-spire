"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { AnimationState, Skeleton, SpineCanvas } from "@esotericsoftware/spine-player";
import Image from "@/components/ui/static-image";
import { loadSpinePlayerRuntime, type SpinePlayerRuntime } from "@/lib/spine-player-runtime";

const GAME_VIEWPORT_WIDTH = 1920;
const GAME_VIEWPORT_HEIGHT = 1080;
const TARGET_FRAME_SECONDS = 1 / 30;
const MAX_DEVICE_PIXEL_RATIO = 1.5;
const WEBGL_CONFIG: WebGLContextAttributes = {
  alpha: true,
  antialias: true,
  preserveDrawingBuffer: false,
};

interface FakeMerchantLayerConfig {
  atlasUrl: string;
  binaryUrl: string;
  animation: string;
  scale: number;
  x: number;
  y: number;
}

type FakeMerchantLayerId = "bottom" | "merchant" | "cutter";

interface FakeMerchantLayer {
  animationState: AnimationState;
  skeleton: Skeleton;
}

const FAKE_MERCHANT_LAYERS: Record<FakeMerchantLayerId, FakeMerchantLayerConfig> = {
  bottom: {
    atlasUrl: "/spine/sts2/event-backgrounds/fake_merchant_room/bottom/shop_fake_merchant_bottom.atlas",
    binaryUrl: "/spine/sts2/event-backgrounds/fake_merchant_room/bottom/shop_fake_merchant_bottom.skel",
    animation: "idle_loop",
    // fake_merchant.tscn: BgContainer 1.01 × FakeMerchantBackground 0.5.
    scale: 0.505,
    x: -10,
    y: 20,
  },
  merchant: {
    atlasUrl: "/spine/sts2/event-backgrounds/fake_merchant_room/top/fake_merchant_top.atlas",
    binaryUrl: "/spine/sts2/event-backgrounds/fake_merchant_room/top/fake_merchant_top.skel",
    animation: "idle_loop",
    // fake_merchant.tscn: MerchantButton (1164, 361) + MerchantVisual (139, 400).
    scale: 0.470095,
    x: 1303,
    y: 761,
  },
  cutter: {
    atlasUrl: "/spine/sts2/event-backgrounds/fake_merchant_room/bottom/shop_fake_merchant_bottom_cutter.atlas",
    binaryUrl: "/spine/sts2/event-backgrounds/fake_merchant_room/bottom/shop_fake_merchant_bottom_cutter.skel",
    animation: "idle_loop",
    scale: 0.505,
    x: -10,
    y: 20,
  },
};
const ALL_FAKE_MERCHANT_LAYER_IDS = ["bottom", "merchant", "cutter"] as const;
const ENCOUNTER_LAYER_IDS = {
  bottom: ["bottom"],
  cutter: ["cutter"],
} as const satisfies Record<"bottom" | "cutter", readonly FakeMerchantLayerId[]>;

type LoadState = "loading" | "ready" | "error";

export function FakeMerchantSpineStage({ fallbackImageUrl }: { fallbackImageUrl: string }) {
  return (
    <FakeMerchantSpineCanvas
      layerIds={ALL_FAKE_MERCHANT_LAYER_IDS}
      fallback={(
        <Image
          src={fallbackImageUrl}
          alt=""
          fill
          sizes="(max-width: 1536px) 100vw, 1472px"
          className="object-cover"
        />
      )}
      className="bg-black"
      dataAttribute="data-fake-merchant-spine-stage"
    />
  );
}

export function FakeMerchantEncounterSpineLayer({
  layer,
  fallbackImageUrl = null,
  className = "",
}: {
  layer: Extract<FakeMerchantLayerId, "bottom" | "cutter">;
  fallbackImageUrl?: string | null;
  className?: string;
}) {
  return (
    <FakeMerchantSpineCanvas
      layerIds={ENCOUNTER_LAYER_IDS[layer]}
      fallback={fallbackImageUrl ? (
        <Image
          src={fallbackImageUrl}
          alt=""
          fill
          sizes="(min-width: 1024px) 704px, 100vw"
          className="object-cover"
        />
      ) : null}
      className={className}
      dataAttribute={`data-fake-merchant-encounter-${layer}`}
    />
  );
}

function FakeMerchantSpineCanvas({
  layerIds,
  fallback = null,
  className = "",
  dataAttribute,
}: {
  layerIds: readonly FakeMerchantLayerId[];
  fallback?: ReactNode;
  className?: string;
  dataAttribute: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");

  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;
    if (!prepareWebGl(canvasElement)) {
      const fallbackFrame = requestAnimationFrame(() => setLoadState("error"));
      return () => cancelAnimationFrame(fallbackFrame);
    }

    let disposed = false;
    let spineCanvas: SpineCanvas | null = null;
    let layers: FakeMerchantLayer[] = [];
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
        if (disposed || !canvasRef.current) return;

        spineCanvas = new runtime.SpineCanvas(canvasElement, {
          webglConfig: WEBGL_CONFIG,
          app: {
            loadAssets: (app) => {
              for (const layerId of layerIds) {
                const layer = FAKE_MERCHANT_LAYERS[layerId];
                app.assetManager.loadBinary(layer.binaryUrl);
                app.assetManager.loadTextureAtlas(layer.atlasUrl);
              }
            },
            initialize: (app) => {
              if (disposed) return;
              layers = layerIds.map((layerId) => (
                createLayer(runtime, app, FAKE_MERCHANT_LAYERS[layerId])
              ));
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
              renderLayers(app, layers);
              shouldRender = false;
              renderedReducedMotionFrame = reducedMotion;
              if (!hasMarkedReady) {
                hasMarkedReady = true;
                setLoadState("ready");
              }
            },
            error: (_app, errors) => {
              if (disposed) return;
              console.warn("Failed to load the Fake Merchant Spine scene:", errors);
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
        console.warn("Failed to load the Spine runtime for the Fake Merchant scene:", error);
        setLoadState("error");
      });

    return () => {
      disposed = true;
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      spineCanvas?.dispose();
      spineCanvas = null;
      layers = [];
    };
  }, [layerIds]);

  const dataAttributes = { [dataAttribute]: "" };

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      {...dataAttributes}
      aria-hidden
    >
      {fallback && (
        <div className={`absolute inset-0 transition-opacity duration-300 ${loadState === "ready" ? "opacity-0" : "opacity-100"}`}>
          {fallback}
        </div>
      )}
      <canvas
        ref={canvasRef}
        data-fake-merchant-spine
        className={`absolute inset-0 h-full w-full transition-opacity duration-300 ${loadState === "ready" ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}

function prepareWebGl(canvas: HTMLCanvasElement) {
  return Boolean(
    canvas.getContext("webgl2", WEBGL_CONFIG) ?? canvas.getContext("webgl", WEBGL_CONFIG),
  );
}

function createLayer(
  runtime: SpinePlayerRuntime,
  app: SpineCanvas,
  config: FakeMerchantLayerConfig,
): FakeMerchantLayer {
  const atlas = app.assetManager.require(config.atlasUrl);
  const binary = app.assetManager.require(config.binaryUrl);
  const skeletonLoader = new runtime.SkeletonBinary(new runtime.AtlasAttachmentLoader(atlas));
  const skeletonData = skeletonLoader.readSkeletonData(binary);
  const skeleton = new runtime.Skeleton(skeletonData);
  const defaultSkin = skeletonData.findSkin("default");
  if (defaultSkin) {
    skeleton.setSkin(defaultSkin);
    skeleton.setSlotsToSetupPose();
  }
  skeleton.x = config.x;
  skeleton.y = GAME_VIEWPORT_HEIGHT - config.y;
  skeleton.scaleX = config.scale;
  skeleton.scaleY = config.scale;

  const animationState = new runtime.AnimationState(new runtime.AnimationStateData(skeletonData));
  animationState.setAnimation(0, config.animation, true);
  animationState.apply(skeleton);
  skeleton.updateWorldTransform(runtime.Physics.update);

  return { animationState, skeleton };
}

function renderLayers(app: SpineCanvas, layers: readonly FakeMerchantLayer[]) {
  resizeCanvas(app);
  app.clear(0, 0, 0, 0);
  app.renderer.begin();
  for (const layer of layers) {
    app.renderer.drawSkeleton(layer.skeleton, false);
  }
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
