"use client";

import type { Skin, SpinePlayer, SpinePlayerConfig } from "@esotericsoftware/spine-player";

export type { SpinePlayer, SpinePlayerConfig } from "@esotericsoftware/spine-player";

export type SpinePlayerCtor = new (element: HTMLElement, config: SpinePlayerConfig) => SpinePlayer;
export type SpineSkinCtor = new (name: string) => Skin;
export type SpinePhysics = typeof import("@esotericsoftware/spine-player")["Physics"];
export type SpinePlayerRuntime = typeof import("@esotericsoftware/spine-player");

declare global {
  interface Window {
    spine?: SpinePlayerRuntime;
  }
}

const SPINE_PLAYER_SCRIPT_SRC = "/generated/spine-player.min.js";

let spineRuntimePromise: Promise<SpinePlayerRuntime> | null = null;

export function loadSpinePlayerRuntime(): Promise<SpinePlayerRuntime> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Spine player runtime can only load in the browser"));
  }
  if (window.spine?.SpinePlayer) return Promise.resolve(window.spine);
  if (spineRuntimePromise) return spineRuntimePromise;

  spineRuntimePromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SPINE_PLAYER_SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      if (window.spine?.SpinePlayer) {
        resolve(window.spine);
        return;
      }
      reject(new Error("Spine player runtime did not expose window.spine"));
    };
    script.onerror = () => reject(new Error(`Failed to load ${SPINE_PLAYER_SCRIPT_SRC}`));
    document.head.appendChild(script);
  });

  return spineRuntimePromise;
}
