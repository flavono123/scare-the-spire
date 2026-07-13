"use client";

import { useEffect, useRef, useState } from "react";
import {
  loadEventVfxRuntime,
  type EventVfxController,
} from "@/lib/event-vfx-runtime";

type EventVfxMode = "standard" | "mirror";
type LoadState = "loading" | "ready" | "error";

const SCENE_ROOT = "/generated/event-vfx/scenes";
const DENSE_VEGETATION_SLICE_SCENE = `${SCENE_ROOT}/dense_vegetation_slice.json`;

export function EventVfxStage({
  baseImageUrl,
  burstSignal = 0,
  mode = "standard",
  offsetX = 268,
  offsetY = 49,
  sceneSlug,
}: {
  baseImageUrl?: string;
  burstSignal?: number;
  mode?: EventVfxMode;
  offsetX?: number;
  offsetY?: number;
  sceneSlug: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const controllerRef = useRef<EventVfxController | null>(null);
  const handledBurstRef = useRef(burstSignal);
  const [loadState, setLoadState] = useState<LoadState>("loading");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let controller: EventVfxController | null = null;

    void loadEventVfxRuntime()
      .then((runtime) => runtime.create(canvas, {
        baseImageUrl,
        mode,
        offsetX,
        offsetY,
        onReady: () => {
          if (!disposed) setLoadState("ready");
        },
        sceneUrl: `${SCENE_ROOT}/${sceneSlug}.json`,
      }))
      .then((createdController) => {
        if (disposed) {
          createdController.destroy();
          return;
        }
        controller = createdController;
        controllerRef.current = createdController;
      })
      .catch((error: unknown) => {
        if (disposed) return;
        console.warn(`Failed to render the ${sceneSlug} event VFX scene:`, error);
        setLoadState("error");
      });

    return () => {
      disposed = true;
      controller?.destroy();
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, [baseImageUrl, mode, offsetX, offsetY, sceneSlug]);

  useEffect(() => {
    if (burstSignal <= handledBurstRef.current) return;
    handledBurstRef.current = burstSignal;
    const timers = [0, 280, 590].map((delay) => window.setTimeout(() => {
      const controller = controllerRef.current;
      if (!controller) return;
      // DenseVegetation.TrudgeOn(): 25%/60% of the 1920x1080 VFX container,
      // randomized by ±100 x and ±200 y, converted into portrait coordinates.
      const screenX = 480 + (Math.random() * 200 - 100);
      const screenY = 648 + (Math.random() * 400 - 200);
      const portraitX = 1280 + (screenX - 960) / 1.04;
      const portraitY = 600 + (screenY - 545) / 1.04;
      void controller.playOneShot(DENSE_VEGETATION_SLICE_SCENE, {
        lifetime: 2,
        rotation: -Math.random() * Math.PI,
        x: portraitX,
        y: portraitY,
      });
    }, delay));
    return () => timers.forEach(window.clearTimeout);
  }, [burstSignal]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      data-event-vfx-mode={mode}
      data-event-vfx-scene={sceneSlug}
      data-event-vfx-state={loadState}
      className={`pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-300 ${
        loadState === "ready" ? "opacity-100" : "opacity-0"
      }`}
    />
  );
}
