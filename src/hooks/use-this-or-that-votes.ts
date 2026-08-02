"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";
import {
  changeThisOrThatVoteSummary,
  EMPTY_THIS_OR_THAT_VOTE_SUMMARY,
  type ThisOrThatVoteChoice,
  type ThisOrThatVoteSummary,
  type ThisOrThatVoteSurface,
} from "@/lib/this-or-that-votes";

interface UseThisOrThatVotesReturn {
  summaries: Record<string, ThisOrThatVoteSummary>;
  choices: Record<string, ThisOrThatVoteChoice>;
  pending: Set<string>;
  loading: boolean;
  unavailable: boolean;
  vote: (
    postId: string,
    choice: ThisOrThatVoteChoice,
    surface: ThisOrThatVoteSurface,
  ) => Promise<boolean>;
  cancel: (postId: string) => Promise<boolean>;
}

function postIdKey(postIds: string[]) {
  return [...postIds].sort().join(":");
}

export function useThisOrThatVotes(
  postIds: string[],
  userId: string | null,
  ensureUser: () => Promise<string | null>,
): UseThisOrThatVotesReturn {
  const [summaries, setSummaries] = useState<Record<string, ThisOrThatVoteSummary>>({});
  const [choices, setChoices] = useState<Record<string, ThisOrThatVoteChoice>>({});
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [loadedQueryKey, setLoadedQueryKey] = useState("");
  const [unavailable, setUnavailable] = useState(!supabaseEnabled);
  const pendingRef = useRef<Set<string>>(new Set());
  const mutationVersion = useRef(0);
  const key = useMemo(() => postIdKey(postIds), [postIds]);
  const queryKey = `${key}|${userId ?? ""}`;
  const loading = supabaseEnabled && postIds.length > 0 && loadedQueryKey !== queryKey;

  const markPending = useCallback((postId: string, value: boolean) => {
    const next = new Set(pendingRef.current);
    if (value) next.add(postId);
    else next.delete(postId);
    pendingRef.current = next;
    setPending(next);
  }, []);

  useEffect(() => {
    if (!supabaseEnabled) return;
    if (postIds.length === 0) return;

    let cancelled = false;
    const requestMutationVersion = mutationVersion.current;

    const summaryQuery = withSupabaseTimeout(
      "get_this_or_that_vote_summaries",
      supabase.rpc("get_this_or_that_vote_summaries", {
        p_post_ids: postIds,
        p_env: supabaseEnv,
      }),
    );
    const ownVoteQuery = userId
      ? withSupabaseTimeout(
          "this_or_that_post_votes.user_status",
          supabase
            .from("this_or_that_post_votes")
            .select("post_id,choice")
            .eq("env", supabaseEnv)
            .eq("user_id", userId)
            .in("post_id", postIds),
        )
      : Promise.resolve({ data: [], error: null });

    Promise.all([summaryQuery, ownVoteQuery])
      .then(([summaryResult, ownVoteResult]) => {
        if (summaryResult.error) throw summaryResult.error;
        if (ownVoteResult.error) throw ownVoteResult.error;
        if (cancelled) return;
        if (requestMutationVersion !== mutationVersion.current) {
          setLoadedQueryKey(queryKey);
          return;
        }

        const nextSummaries: Record<string, ThisOrThatVoteSummary> = {};
        for (const row of summaryResult.data ?? []) {
          const summary = row as {
            post_id: unknown;
            left_count: unknown;
            right_count: unknown;
            total_count: unknown;
          };
          nextSummaries[String(summary.post_id)] = {
            leftCount: Number(summary.left_count ?? 0),
            rightCount: Number(summary.right_count ?? 0),
            totalCount: Number(summary.total_count ?? 0),
          };
        }

        const nextChoices: Record<string, ThisOrThatVoteChoice> = {};
        for (const row of ownVoteResult.data ?? []) {
          const vote = row as { post_id: unknown; choice: ThisOrThatVoteChoice };
          nextChoices[String(vote.post_id)] = vote.choice;
        }

        setSummaries((previous) => {
          for (const postId of pendingRef.current) {
            if (previous[postId]) nextSummaries[postId] = previous[postId];
          }
          return nextSummaries;
        });
        setChoices((previous) => {
          for (const postId of pendingRef.current) {
            if (previous[postId]) nextChoices[postId] = previous[postId];
          }
          return nextChoices;
        });
        setUnavailable(false);
        setLoadedQueryKey(queryKey);
      })
      .catch(() => {
        if (cancelled) return;
        setUnavailable(true);
        setLoadedQueryKey(queryKey);
      });

    return () => {
      cancelled = true;
    };
  }, [key, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const vote = useCallback(async (
    postId: string,
    choice: ThisOrThatVoteChoice,
    surface: ThisOrThatVoteSurface,
  ): Promise<boolean> => {
    if (!supabaseEnabled || choices[postId] || pendingRef.current.has(postId)) return false;

    const previousSummary = summaries[postId] ?? EMPTY_THIS_OR_THAT_VOTE_SUMMARY;
    mutationVersion.current += 1;
    markPending(postId, true);
    setChoices((previous) => ({ ...previous, [postId]: choice }));
    setSummaries((previous) => ({
      ...previous,
      [postId]: changeThisOrThatVoteSummary(previousSummary, choice, 1),
    }));

    const activeUserId = userId ?? await ensureUser();
    const result = activeUserId
      ? await withSupabaseTimeout(
          "this_or_that_post_votes.insert",
          supabase.from("this_or_that_post_votes").insert({
            post_id: postId,
            user_id: activeUserId,
            choice,
            created_surface: surface,
            env: supabaseEnv,
          }),
        ).catch(() => ({ error: new Error("timeout") }))
      : { error: new Error("auth unavailable") };

    mutationVersion.current += 1;
    markPending(postId, false);
    if (!result.error) {
      setUnavailable(false);
      return true;
    }

    setChoices((previous) => {
      const next = { ...previous };
      delete next[postId];
      return next;
    });
    setSummaries((previous) => ({ ...previous, [postId]: previousSummary }));
    setUnavailable(true);
    return false;
  }, [choices, ensureUser, markPending, summaries, userId]);

  const cancel = useCallback(async (postId: string): Promise<boolean> => {
    const choice = choices[postId];
    if (!supabaseEnabled || !userId || !choice || pendingRef.current.has(postId)) return false;

    const previousSummary = summaries[postId] ?? EMPTY_THIS_OR_THAT_VOTE_SUMMARY;
    mutationVersion.current += 1;
    markPending(postId, true);
    setChoices((previous) => {
      const next = { ...previous };
      delete next[postId];
      return next;
    });
    setSummaries((previous) => ({
      ...previous,
      [postId]: changeThisOrThatVoteSummary(previousSummary, choice, -1),
    }));

    const { error } = await withSupabaseTimeout(
      "this_or_that_post_votes.delete",
      supabase
        .from("this_or_that_post_votes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", userId)
        .eq("env", supabaseEnv),
    ).catch(() => ({ error: new Error("timeout") }));

    mutationVersion.current += 1;
    markPending(postId, false);
    if (!error) {
      setUnavailable(false);
      return true;
    }

    setChoices((previous) => ({ ...previous, [postId]: choice }));
    setSummaries((previous) => ({ ...previous, [postId]: previousSummary }));
    setUnavailable(true);
    return false;
  }, [choices, markPending, summaries, userId]);

  return { summaries, choices, pending, loading, unavailable, vote, cancel };
}
