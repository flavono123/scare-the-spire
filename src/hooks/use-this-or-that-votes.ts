"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  changeThisOrThatVoteSummary,
  EMPTY_THIS_OR_THAT_VOTE_SUMMARY,
  type ThisOrThatVoteChoice,
  type ThisOrThatVoteSummary,
  type ThisOrThatVoteSurface,
} from "@/lib/this-or-that-votes";
import {
  apiMyThisOrThatVotes,
  apiThisOrThatUnvote,
  apiThisOrThatVote,
  apiThisOrThatVoteSummaries,
} from "@/lib/toybox-api";

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
  const [unavailable, setUnavailable] = useState(false);
  const pendingRef = useRef<Set<string>>(new Set());
  const mutationVersion = useRef(0);
  const key = useMemo(() => postIdKey(postIds), [postIds]);
  const queryKey = `${key}|${userId ?? ""}`;
  const loading = postIds.length > 0 && loadedQueryKey !== queryKey;

  const markPending = useCallback((postId: string, value: boolean) => {
    const next = new Set(pendingRef.current);
    if (value) next.add(postId);
    else next.delete(postId);
    pendingRef.current = next;
    setPending(next);
  }, []);

  useEffect(() => {
    if (postIds.length === 0) return;

    let cancelled = false;
    const requestMutationVersion = mutationVersion.current;

    const load = async (): Promise<{ summaryRows: unknown[]; ownVoteRows: unknown[] }> => {
      // docs/supabase-exit/STEP1_DESIGN.md 9.8: the same RPC and rows, through the Worker.
      // Over 50 ids the summaries call fails as the RPC does, so neither read needs chunks.
      const ids = [...new Set(postIds)];
      const [summaryRows, ownVoteRows] = await Promise.all([
        apiThisOrThatVoteSummaries(ids),
        userId ? apiMyThisOrThatVotes(ids) : [],
      ]);
      return { summaryRows, ownVoteRows };
    };

    load()
      .then(({ summaryRows, ownVoteRows }) => {
        if (cancelled) return;
        if (requestMutationVersion !== mutationVersion.current) {
          setLoadedQueryKey(queryKey);
          return;
        }

        const nextSummaries: Record<string, ThisOrThatVoteSummary> = {};
        for (const row of summaryRows) {
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
        for (const row of ownVoteRows) {
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
    if (choices[postId] || pendingRef.current.has(postId)) return false;

    const previousSummary = summaries[postId] ?? EMPTY_THIS_OR_THAT_VOTE_SUMMARY;
    mutationVersion.current += 1;
    markPending(postId, true);
    setChoices((previous) => ({ ...previous, [postId]: choice }));
    setSummaries((previous) => ({
      ...previous,
      [postId]: changeThisOrThatVoteSummary(previousSummary, choice, 1),
    }));

    const activeUserId = userId ?? await ensureUser();
    // No user (auth unavailable) fails like a refused vote.
    let failed = !activeUserId;
    if (activeUserId) {
      try {
        await apiThisOrThatVote(postId, choice, surface);
      } catch {
        failed = true;
      }
    }

    mutationVersion.current += 1;
    markPending(postId, false);
    if (!failed) {
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
    if (!userId || !choice || pendingRef.current.has(postId)) return false;

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

    let failed = false;
    try {
      await apiThisOrThatUnvote(postId);
    } catch {
      failed = true;
    }

    mutationVersion.current += 1;
    markPending(postId, false);
    if (!failed) {
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
