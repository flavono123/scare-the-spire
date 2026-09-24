"use client";

import { useCallback, useEffect, useState } from "react";
import {
  isColorfulPhilosopherReaction,
  type ColorfulPhilosopherReaction,
} from "@/lib/colorful-philosophers";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";

export interface ResourceReactionCounts {
  buff: number;
  nerf: number;
  rework: number;
}

function storageKey(resourceType: string, resourceId: string, gameVersion: string) {
  return `sts-resource-reaction:${resourceType}:${resourceId}:${gameVersion}`;
}

export async function saveResourceReaction(input: {
  resourceType: string;
  resourceId: string;
  gameVersion: string;
  userId: string;
  previous: ColorfulPhilosopherReaction | null;
  next: ColorfulPhilosopherReaction;
}) {
  const nextKind = input.previous === input.next ? null : input.next;
  const key = storageKey(input.resourceType, input.resourceId, input.gameVersion);
  if (nextKind) window.localStorage.setItem(key, nextKind);
  else window.localStorage.removeItem(key);
  const scoped = {
    env: supabaseEnv,
    resource_type: input.resourceType,
    resource_id: input.resourceId,
    game_version: input.gameVersion,
    user_id: input.userId,
  };
  const write = nextKind === null
    ? supabase.from("resource_reactions").delete().match(scoped)
    : input.previous
      ? supabase.from("resource_reactions").update({ kind: nextKind }).match(scoped)
      : supabase.from("resource_reactions").insert({ ...scoped, kind: nextKind });
  const { error } = await write;
  if (error) {
    if (input.previous) window.localStorage.setItem(key, input.previous);
    else window.localStorage.removeItem(key);
    return { ok: false as const };
  }
  return { ok: true as const, kind: nextKind };
}

export function useResourceReactions(
  resourceType: string,
  resourceId: string,
  gameVersion: string,
  userId: string | null = null,
) {
  const [counts, setCounts] = useState<ResourceReactionCounts>({ buff: 0, nerf: 0, rework: 0 });
  const [kind, setKind] = useState<ColorfulPhilosopherReaction | null>(null);
  const [loading, setLoading] = useState(supabaseEnabled && Boolean(resourceType && resourceId && gameVersion));
  const [unavailable, setUnavailable] = useState(false);
  const [pendingKind, setPendingKind] = useState<ColorfulPhilosopherReaction | null>(null);

  useEffect(() => {
    const cached = window.localStorage.getItem(storageKey(resourceType, resourceId, gameVersion));
    setKind(cached && isColorfulPhilosopherReaction(cached) ? cached : null);
  }, [resourceType, resourceId, gameVersion]);

  useEffect(() => {
    if (!supabaseEnabled || !resourceType || !resourceId || !gameVersion) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase.from("resource_reaction_counts")
      .select("buff_count, nerf_count, rework_count")
      .eq("env", supabaseEnv)
      .eq("resource_type", resourceType)
      .eq("resource_id", resourceId)
      .eq("game_version", gameVersion)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setUnavailable(true);
          setLoading(false);
          return;
        }
        setUnavailable(false);
        setCounts({
          buff: data?.buff_count ?? 0,
          nerf: data?.nerf_count ?? 0,
          rework: data?.rework_count ?? 0,
        });
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [resourceType, resourceId, gameVersion]);

  useEffect(() => {
    if (!supabaseEnabled || !userId || !resourceType || !resourceId || !gameVersion) return;
    let cancelled = false;
    supabase.from("resource_reactions")
      .select("kind")
      .eq("env", supabaseEnv)
      .eq("resource_type", resourceType)
      .eq("resource_id", resourceId)
      .eq("game_version", gameVersion)
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error) return;
        const next = data && isColorfulPhilosopherReaction(data.kind) ? data.kind : null;
        setKind(next);
        const key = storageKey(resourceType, resourceId, gameVersion);
        if (next) window.localStorage.setItem(key, next);
        else window.localStorage.removeItem(key);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, resourceType, resourceId, gameVersion]);

  const choose = useCallback(async (next: ColorfulPhilosopherReaction, userId: string) => {
    const previous = kind;
    const previousCounts = counts;
    const nextKind = previous === next ? null : next;
    setPendingKind(next);
    setKind(nextKind);
    setCounts((current) => {
      const updated = { ...current };
      if (previous) updated[previous] = Math.max(0, updated[previous] - 1);
      if (nextKind) updated[nextKind] += 1;
      return updated;
    });
    const key = storageKey(resourceType, resourceId, gameVersion);
    if (nextKind) window.localStorage.setItem(key, nextKind);
    else window.localStorage.removeItem(key);
    const scoped = supabase.from("resource_reactions")
      .eq("env", supabaseEnv)
      .eq("resource_type", resourceType)
      .eq("resource_id", resourceId)
      .eq("game_version", gameVersion)
      .eq("user_id", userId);
    const write = nextKind === null
      ? scoped.delete()
      : previous
        ? scoped.update({ kind: nextKind })
        : supabase.from("resource_reactions").insert({
          env: supabaseEnv,
          resource_type: resourceType,
          resource_id: resourceId,
          game_version: gameVersion,
          user_id: userId,
          kind: nextKind,
        });
    const { error } = await write;
    setPendingKind(null);
    if (error) {
      setKind(previous);
      setCounts(previousCounts);
      setUnavailable(true);
      if (previous) window.localStorage.setItem(key, previous);
      else window.localStorage.removeItem(key);
      return { ok: false as const };
    }
    setUnavailable(false);
    return { ok: true as const };
  }, [counts, gameVersion, kind, resourceId, resourceType]);

  return { counts, kind, loading, unavailable, pendingKind, choose };
}
