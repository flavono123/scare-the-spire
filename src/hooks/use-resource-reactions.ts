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
} from "@/lib/api-engagement";
import { apiFetchAsUser } from "@/lib/api-session";
import { reactionTargetKey } from "@/lib/engagement-keys";

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

/**
 * Totals for a small, bounded set of resources (e.g. a week's reel), from
 * /api/read/engagement?reactions= (asks made together share one request). A
 * target the Worker refuses counts zero; any failure gives null.
 */
export async function fetchResourceReactionCounts(
  targets: readonly ResourceReactionTarget[],
): Promise<Map<string, ResourceReactionCounts> | null> {
  if (targets.length === 0) return null;
  const keys = Array.from(new Set(targets.map(resourceReactionKey)));
  try {
    const rows = await Promise.all(keys.map((key) => (
      engagementApiFor("reactions", key) ? loadEngagement("reactions", key) : Promise.resolve(null)
    )));
    const counts = new Map<string, ResourceReactionCounts>();
    keys.forEach((key, index) => {
      const row = rows[index];
      counts.set(key, { buff: row?.buff ?? 0, nerf: row?.nerf ?? 0, rework: row?.rework ?? 0 });
    });
    return counts;
  } catch {
    return null;
  }
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
  const target = { resourceType: input.resourceType, resourceId: input.resourceId, gameVersion: input.gameVersion };
  const targetKey = reactionTargetKey(target);
  // The Worker knows the user (input.userId only says the caller has one) and reads the current
  // row. A target it refuses takes no reaction, as the closed direct insert refused it.
  const saved = engagementApiFor("reactions", targetKey) && await apiFetchAsUser(
    "comments",
    "/api/write/reactions",
    { method: "PUT", body: { ...target, kind: nextKind } },
  ).then(() => true, () => false);
  if (!saved) {
    if (input.previous) window.localStorage.setItem(key, input.previous);
    else window.localStorage.removeItem(key);
    return { ok: false as const };
  }
  forgetEngagement("reactions", targetKey);
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
  const [loading, setLoading] = useState(Boolean(resourceType && resourceId && gameVersion));
  const [unavailable, setUnavailable] = useState(false);
  const [pendingKind, setPendingKind] = useState<ColorfulPhilosopherReaction | null>(null);

  useEffect(() => {
    const cached = window.localStorage.getItem(storageKey(resourceType, resourceId, gameVersion));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read this browser's reaction after paint
    setKind(cached && isColorfulPhilosopherReaction(cached) ? cached : null);
  }, [resourceType, resourceId, gameVersion]);

  useEffect(() => {
    if (!resourceType || !resourceId || !gameVersion) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- there is no reaction row to query
      setLoading(false);
      return;
    }
    const targetKey = reactionTargetKey({ resourceType, resourceId, gameVersion });
    let cancelled = false;
    setLoading(true);
    // A target the Worker refuses is an empty thread: no reactions.
    const read = engagementApiFor("reactions", targetKey)
      ? loadEngagement("reactions", targetKey)
      : Promise.resolve({ buff: 0, nerf: 0, rework: 0 });
    read
      .then((next) => {
        if (cancelled) return;
        setUnavailable(false);
        setCounts({ buff: next.buff, nerf: next.nerf, rework: next.rework });
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setUnavailable(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [resourceType, resourceId, gameVersion]);

  useEffect(() => {
    if (!userId || !resourceType || !resourceId || !gameVersion) return;
    const targetKey = reactionTargetKey({ resourceType, resourceId, gameVersion });
    const viaApi = engagementApiFor("reactions", targetKey);
    if (viaApi && !personal) return;
    let cancelled = false;
    // A target the Worker refuses is an empty thread: this user has no reaction on it.
    const read = viaApi ? loadEngagementMine("reactions", targetKey) : Promise.resolve(null);
    read
      .then((next) => {
        if (cancelled) return;
        setKind(next);
        const key = storageKey(resourceType, resourceId, gameVersion);
        if (next) window.localStorage.setItem(key, next);
        else window.localStorage.removeItem(key);
      })
      // A failure keeps this browser's cached reaction.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [personal, userId, resourceType, resourceId, gameVersion]);

  const choose = useCallback(async (next: ColorfulPhilosopherReaction, activeUserId: string) => {
    // The Worker knows the user; callers pass the one ensureUser gave them.
    void activeUserId;
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
    const targetKey = reactionTargetKey({ resourceType, resourceId, gameVersion });
    // A target the Worker refuses takes no reaction, as the closed direct insert refused it.
    if (!engagementApiFor("reactions", targetKey)) {
      setPendingKind(null);
      revert();
      return { ok: false as const };
    }
    try {
      // The Worker reads the current row, so a stale kind from another tab cannot conflict.
      const result = await apiFetchAsUser<{ kind: ColorfulPhilosopherReaction | null; counts: ResourceReactionCounts | null }>(
        "comments",
        "/api/write/reactions",
        { method: "PUT", body: { resourceType, resourceId, gameVersion, kind: nextKind } },
      );
      forgetEngagement("reactions", targetKey);
      setPendingKind(null);
      setUnavailable(false);
      setKind(result.kind);
      // Null totals: the write is committed but they could not be read; keep the optimistic ones.
      if (result.counts) setCounts({ buff: result.counts.buff, nerf: result.counts.nerf, rework: result.counts.rework });
      return { ok: true as const };
    } catch {
      setPendingKind(null);
      revert();
      return { ok: false as const };
    }
  }, [counts, gameVersion, kind, resourceId, resourceType]);

  return { counts, kind, loading, unavailable, pendingKind, choose };
}
