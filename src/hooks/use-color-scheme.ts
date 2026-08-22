"use client";

import { useCallback, useLayoutEffect, useMemo, useSyncExternalStore } from "react";
import {
  COLOR_SCHEME_CHANGE_EVENT,
  COLOR_SCHEME_STORAGE_KEY,
  applyResolvedColorScheme,
  parseColorSchemePreference,
  readStoredColorSchemePreference,
  resolveColorScheme,
  systemPrefersLight,
  writeStoredColorSchemePreference,
  type ColorSchemePreference,
  type ResolvedColorScheme,
} from "@/lib/color-scheme";

function subscribeColorScheme(onStoreChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === COLOR_SCHEME_STORAGE_KEY) {
      onStoreChange();
    }
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener(COLOR_SCHEME_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(COLOR_SCHEME_CHANGE_EVENT, onStoreChange);
  };
}

function getColorSchemeSnapshot() {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(COLOR_SCHEME_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function getColorSchemeServerSnapshot() {
  return "";
}

function subscribeSystemColorScheme(onStoreChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: light)");
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

function getSystemColorSchemeSnapshot() {
  return systemPrefersLight() ? "light" : "dark";
}

function getSystemColorSchemeServerSnapshot() {
  return "dark";
}

function applyStoredColorScheme() {
  applyResolvedColorScheme(
    document.documentElement,
    resolveColorScheme(readStoredColorSchemePreference(), systemPrefersLight()),
  );
}

export function useColorScheme(): {
  preference: ColorSchemePreference;
  resolved: ResolvedColorScheme;
  setPreference: (preference: ColorSchemePreference) => void;
} {
  const stored = useSyncExternalStore(
    subscribeColorScheme,
    getColorSchemeSnapshot,
    getColorSchemeServerSnapshot,
  );
  const systemScheme = useSyncExternalStore(
    subscribeSystemColorScheme,
    getSystemColorSchemeSnapshot,
    getSystemColorSchemeServerSnapshot,
  );

  const preference = useMemo(() => parseColorSchemePreference(stored), [stored]);
  const resolved = resolveColorScheme(preference, systemScheme === "light");

  const setPreference = useCallback((next: ColorSchemePreference) => {
    writeStoredColorSchemePreference(next);
  }, []);

  return { preference, resolved, setPreference };
}

/** Re-apply after hydration and when the OS scheme changes. Do not use the SSR snapshot. */
export function ColorSchemeDocumentAttributes() {
  useLayoutEffect(() => {
    applyStoredColorScheme();
    const media = window.matchMedia("(prefers-color-scheme: light)");
    media.addEventListener("change", applyStoredColorScheme);
    window.addEventListener("storage", applyStoredColorScheme);
    window.addEventListener(COLOR_SCHEME_CHANGE_EVENT, applyStoredColorScheme);
    return () => {
      media.removeEventListener("change", applyStoredColorScheme);
      window.removeEventListener("storage", applyStoredColorScheme);
      window.removeEventListener(COLOR_SCHEME_CHANGE_EVENT, applyStoredColorScheme);
    };
  }, []);

  return null;
}
