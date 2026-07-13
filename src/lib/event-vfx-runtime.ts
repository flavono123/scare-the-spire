"use client";

export interface EventVfxOneShotPlacement {
  lifetime?: number;
  rotation?: number;
  scale?: number;
  x: number;
  y: number;
}

export interface EventVfxController {
  destroy(): void;
  playOneShot(sceneUrl: string, placement: EventVfxOneShotPlacement): Promise<void>;
  restart(): void;
}

interface EventVfxPlayerOptions {
  baseImageUrl?: string;
  mode?: "standard" | "mirror";
  offsetX?: number;
  offsetY?: number;
  onReady?: () => void;
  scale?: number;
  sceneUrl: string;
}

interface EventVfxPlayerRuntime {
  create(canvas: HTMLCanvasElement, options: EventVfxPlayerOptions): Promise<EventVfxController>;
}

declare global {
  interface Window {
    EventVfxPlayer?: EventVfxPlayerRuntime;
  }
}

const EVENT_VFX_PLAYER_SCRIPT_SRC = "/event-vfx-player.js";

let runtimePromise: Promise<EventVfxPlayerRuntime> | null = null;

export function loadEventVfxRuntime(): Promise<EventVfxPlayerRuntime> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Event VFX runtime can only load in the browser"));
  }
  if (window.EventVfxPlayer) return Promise.resolve(window.EventVfxPlayer);
  if (runtimePromise) return runtimePromise;

  runtimePromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${EVENT_VFX_PLAYER_SCRIPT_SRC}"]`,
    );
    const script = existing ?? document.createElement("script");
    script.src = EVENT_VFX_PLAYER_SCRIPT_SRC;
    script.async = true;
    script.addEventListener("load", () => {
      if (window.EventVfxPlayer) {
        resolve(window.EventVfxPlayer);
      } else {
        reject(new Error("Event VFX script did not expose window.EventVfxPlayer"));
      }
    }, { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error(`Failed to load ${EVENT_VFX_PLAYER_SCRIPT_SRC}`)),
      { once: true },
    );
    if (!existing) document.head.appendChild(script);
  });

  return runtimePromise;
}
