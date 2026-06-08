"use client";

import { useSyncExternalStore } from "react";

const URL_CHANGE_EVENT = "codex:urlchange";

function readSearchParam(paramName: string): string | null {
  if (typeof window === "undefined") return null;
  return new URL(window.location.href).searchParams.get(paramName);
}

export function addCodexUrlChangeListener(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  window.addEventListener("popstate", onStoreChange);
  window.addEventListener(URL_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener(URL_CHANGE_EVENT, onStoreChange);
  };
}

function subscribeToUrlChanges(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const unsubscribe = addCodexUrlChangeListener(onStoreChange);
  const hydrationRefresh = window.setTimeout(onStoreChange, 0);
  const hydrationRefreshLate = window.setTimeout(onStoreChange, 500);

  return () => {
    window.clearTimeout(hydrationRefresh);
    window.clearTimeout(hydrationRefreshLate);
    unsubscribe();
  };
}

export function notifyCodexUrlChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(URL_CHANGE_EVENT));
}

export function pushCodexHistoryState(url: string | URL): void {
  if (typeof window === "undefined") return;
  History.prototype.pushState.call(window.history, null, "", url.toString());
  notifyCodexUrlChange();
}

export function useHydrationSafeSearchParam(
  paramName: string,
  serverSnapshot: string | null = null,
): string | null {
  return useSyncExternalStore(
    subscribeToUrlChanges,
    () => readSearchParam(paramName),
    () => serverSnapshot,
  );
}
