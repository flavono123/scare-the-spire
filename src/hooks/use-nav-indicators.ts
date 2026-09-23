"use client";

import { useEffect, useState } from "react";
import {
  NAV_INDICATORS_OFF,
  NAV_INDICATORS_TABLE,
  isMissingNavIndicatorsTable,
  navIndicatorFlagsFromRow,
  readNavIndicatorCache,
  writeNavIndicatorCache,
  type NavIndicatorFlags,
} from "@/lib/nav-indicators";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";

const NAV_INDICATORS_EVENT = "sts-nav-indicators";
let revision = 0;

export function publishNavIndicators(flags: NavIndicatorFlags): void {
  revision += 1;
  if (typeof window === "undefined") return;
  writeNavIndicatorCache(window.sessionStorage, supabaseEnv, flags, Date.now());
  window.dispatchEvent(new CustomEvent<NavIndicatorFlags>(NAV_INDICATORS_EVENT, { detail: flags }));
}

export async function fetchNavIndicators(): Promise<NavIndicatorFlags | null> {
  if (!supabaseEnabled) return null;
  const seen = revision;

  try {
    const { data, error } = await withSupabaseTimeout(
      "nav_indicators.select",
      supabase
        .from(NAV_INDICATORS_TABLE)
        .select("patch_notes, toy_box")
        .eq("env", supabaseEnv)
        .maybeSingle(),
    );
    if (error) {
      if (!isMissingNavIndicatorsTable(error) && process.env.NODE_ENV === "development") {
        console.warn("Failed to load nav indicators", error.message);
      }
      return null;
    }
    if (seen !== revision) return null;
    return navIndicatorFlagsFromRow(data);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "Failed to load nav indicators",
        error instanceof Error ? error.message : error,
      );
    }
    return null;
  }
}

export function useNavIndicators(): NavIndicatorFlags {
  const [flags, setFlags] = useState<NavIndicatorFlags>(NAV_INDICATORS_OFF);

  useEffect(() => {
    const applyCached = () => {
      const cached = readNavIndicatorCache(window.sessionStorage, supabaseEnv, Date.now());
      if (cached) setFlags(cached);
      return cached;
    };
    const cached = applyCached();

    const onUpdate = (event: Event) => {
      const detail = (event as CustomEvent<NavIndicatorFlags>).detail;
      if (detail) setFlags(navIndicatorFlagsFromRow({
        patch_notes: detail.patchNotes,
        toy_box: detail.toyBox,
      }));
    };
    window.addEventListener(NAV_INDICATORS_EVENT, onUpdate);
    if (!cached) {
      void fetchNavIndicators().then((next) => {
        if (!next) return;
        publishNavIndicators(next);
      });
    }

    return () => window.removeEventListener(NAV_INDICATORS_EVENT, onUpdate);
  }, []);

  return flags;
}
