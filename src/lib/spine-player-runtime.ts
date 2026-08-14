"use client";

import type { Downloader, Skin, SpinePlayer, SpinePlayerConfig } from "@esotericsoftware/spine-player";

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

type SpinePlainTextDownloader = {
  rawDataUris: Record<string, string>;
  dataUriToString(dataUri: string): string;
  start(
    url: string,
    success: (data: string) => void,
    error: (status: number, responseText: string) => void,
  ): boolean | void;
  finish(url: string, status: number, data: string): void;
  downloadText(
    url: string,
    success: (data: string) => void,
    error: (status: number, responseText: string) => void,
  ): void;
};

export function createSpinePlainTextDownloader(runtime: SpinePlayerRuntime): Downloader {
  const downloader = new runtime.Downloader() as unknown as SpinePlainTextDownloader;
  downloader.downloadText = function downloadText(url, success, error) {
    if (this.start(url, success, error)) return;
    const rawDataUri = this.rawDataUris[url];
    if (rawDataUri && !rawDataUri.includes(".")) {
      try {
        this.finish(url, 200, this.dataUriToString(rawDataUri));
      } catch (errorValue) {
        this.finish(url, 400, JSON.stringify(errorValue));
      }
      return;
    }
    const request = new XMLHttpRequest();
    request.overrideMimeType("text/plain; charset=UTF-8");
    request.open("GET", rawDataUri ? rawDataUri : url, true);
    const done = () => {
      this.finish(url, request.status, request.responseText);
    };
    request.onload = done;
    request.onerror = done;
    request.send();
  };
  return downloader as unknown as Downloader;
}

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
