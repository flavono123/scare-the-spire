"use client";

import { useCallback, useEffect, useState } from "react";
import {
  isColorfulPhilosopherReaction,
  type ColorfulPhilosopherReaction,
} from "@/lib/colorful-philosophers";
import {
  engagementApiFor,
  forgetEngagement,
  loadEngagement,
  loadEngagementMine,
  shouldUseLegacy,
  writeMayGoLegacy,
} from "@/lib/api-engagement";
import { apiFetchAsUser } from "@/lib/api-session";
import { reactionTargetKey } from "@/lib/engagement-keys";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";

export interface ResourceReactionCounts {
  buff: number;
  nerf: number;
  rework: number;
}

export interface ResourceReactionTarget {
  resourceType: string;
  resourceId: string;
  gameVersion: string;
}

function storageKey(resourceType: string, resourceId: string, gameVersion: string) {
  return `sts-resource-reaction:${resourceType}:${resourceId}:${gameVersion}`;
}

export function resourceReactionKey(target: ResourceReactionTarget): string {
  return `${target.resourceType}:${target.resourceId}:${target.gameVersion}`;
}

export function readResourceReaction(target: ResourceReactionTarget): ColorfulPhilosopherReaction | null {
  if (typeof window === "undefined") return null;
  const cached = window.localStorage.getItem(storageKey(target.resourceType, target.resourceId, target.gameVersion));
  return cached && isColorfulPhilosopherReaction(cached) ? cached : null;
}

/** One request for a small, bounded set of resources (e.g. a week's reel). */
export async function fetchResourceReactionCounts(
  targets: readonly ResourceReactionTarget[],
): Promise<Map<string, ResourceReactionCounts> | null> {
  if (!supabaseEnabled || targets.length === 0) return null;
  const ids = Array.from(new Set(targets.map((target) => target.resourceId)));
  const { data, error } = await supabase.from("resource_reaction_counts")
    .select("resource_type, resource_id, game_version, buff_count, nerf_count, rework_count")
    .eq("env", supabaseEnv)
    .in("resource_id", ids);
  if (error) return null;
  const wanted = new Set(targets.map(resourceReactionKey));
  const counts = new Map<string, ResourceReactionCounts>();
  for (const target of targets) counts.set(resourceReactionKey(target), { buff: 0, nerf: 0, rework: 0 });
  for (const row of data ?? []) {
    const key = resourceReactionKey({
      resourceType: String(row.resource_type),
      resourceId: String(row.resource_id),
      gameVersion: String(row.game_version),
    });
    if (!wanted.has(key)) continue;
    counts.set(key, {
      buff: row.buff_count ?? 0,
      nerf: row.nerf_count ?? 0,
      rework: row.rework_count ?? 0,
    });
  }
  return counts;
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
  {
    personal = true,
  }: {
    /** False for read-only bars: the api path then skips this user's reaction, which they never show. */
    personal?: boolean;
  } = {},
) {
  const [counts, setCounts] = useState<ResourceReactionCounts>({ buff: 0, nerf: 0, rework: 0 });
  const [kind, setKind] = useState<ColorfulPhilosopherReaction | null>(null);
  const [loading, setLoading] = useState(supabaseEnabled && Boolean(resourceType && resourceId && gameVersion));
  const [unavailable, setUnavailable] = useState(false);
  const [pendingKind, setPendingKind] = useState<ColorfulPhilosopherReaction | null>(null);

  useEffect(() => {
    const cached = window.localStorage.getItem(storageKey(resourceType, resourceId, gameVersion));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read this browser's reaction after paint
    setKind(cached && isColorfulPhilosopherReaction(cached) ? cached : null);
  }, [resourceType, resourceId, gameVersion]);

  useEffect(() => {
    const targetKey = reactionTargetKey({ resourceType, resourceId, gameVersion });
    const viaApi = Boolean(resourceType && resourceId && gameVersion) && engagementApiFor("reactions", targetKey);
    if ((!supabaseEnabled && !viaApi) || !resourceType || !resourceId || !gameVersion) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- there is no reaction row to query
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const loadLegacy = () => {
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
    };
    if (viaApi) {
      loadEngagement("reactions", targetKey)
        .then((next) => {
          if (cancelled) return;
          setUnavailable(false);
          setCounts({ buff: next.buff, nerf: next.nerf, rework: next.rework });
          setLoading(false);
        })
        .catch((error) => {
          if (cancelled) return;
          if (shouldUseLegacy(error) && supabaseEnabled) {
            loadLegacy();
            return;
          }
          setUnavailable(true);
          setLoading(false);
        });
    } else {
      loadLegacy();
    }
    return () => {
      cancelled = true;
    };
  }, [resourceType, resourceId, gameVersion]);

  useEffect(() => {
    if (!supabaseEnabled || !userId || !resourceType || !resourceId || !gameVersion) return;
    let cancelled = false;
    const remember = (next: ColorfulPhilosopherReaction | null) => {
      setKind(next);
      const key = storageKey(resourceType, resourceId, gameVersion);
      if (next) window.localStorage.setItem(key, next);
      else window.localStorage.removeItem(key);
    };
    const loadLegacy = () => {
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
          remember(data && isColorfulPhilosopherReaction(data.kind) ? data.kind : null);
        });
    };
    const targetKey = reactionTargetKey({ resourceType, resourceId, gameVersion });
    if (engagementApiFor("reactions", targetKey)) {
      if (!personal) return;
      loadEngagementMine("reactions", targetKey)
        .then((next) => {
          if (!cancelled) remember(next);
        })
        .catch((error) => {
          // Other failures keep this browser's cached reaction, as the legacy query ignores its errors.
          if (!cancelled && shouldUseLegacy(error)) loadLegacy();
        });
    } else {
      loadLegacy();
    }
    return () => {
      cancelled = true;
    };
  }, [personal, userId, resourceType, resourceId, gameVersion]);

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
    const revert = () => {
      setKind(previous);
      setCounts(previousCounts);
      setUnavailable(true);
      if (previous) window.localStorage.setItem(key, previous);
      else window.localStorage.removeItem(key);
    };
    if (engagementApiFor("reactions", reactionTargetKey({ resourceType, resourceId, gameVersion }))) {
      try {
        // The Worker reads the current row, so a stale kind from another tab cannot conflict.
        const result = await apiFetchAsUser<{ kind: ColorfulPhilosopherReaction | null; counts: ResourceReactionCounts | null }>(
          "comments",
          "/api/write/reactions",
          { method: "PUT", body: { resourceType, resourceId, gameVersion, kind: nextKind } },
        );
        forgetEngagement("reactions", reactionTargetKey({ resourceType, resourceId, gameVersion }));
        setPendingKind(null);
        setUnavailable(false);
        setKind(result.kind);
        // Null totals: the write is committed but they could not be read; keep the optimistic ones.
        if (result.counts) setCounts({ buff: result.counts.buff, nerf: result.counts.nerf, rework: result.counts.rework });
        return { ok: true as const };
      } catch (error) {
        if (!writeMayGoLegacy(error)) {
          setPendingKind(null);
          revert();
          return { ok: false as const };
        }
      }
    }
    const match = {
      env: supabaseEnv,
      resource_type: resourceType,
      resource_id: resourceId,
      game_version: gameVersion,
      user_id: userId,
    };
    const write = nextKind === null
      ? supabase.from("resource_reactions").delete().match(match)
      : previous
        ? supabase.from("resource_reactions").update({ kind: nextKind }).match(match)
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
      revert();
      return { ok: false as const };
    }
    setUnavailable(false);
    return { ok: true as const };
  }, [counts, gameVersion, kind, resourceId, resourceType]);

  return { counts, kind, loading, unavailable, pendingKind, choose };
}
