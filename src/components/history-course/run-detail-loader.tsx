"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HistoryCourseShell } from "@/components/history-course/history-course-shell";
import { collectRelevantCardIds } from "@/components/history-course/topbar-state";
import { loadRun } from "@/lib/run-store";
import type { CodexCard } from "@/lib/codex-types";
import { parseRunRouteSlug } from "@/lib/sts2-run-hash";
import { parseReplayRun, type ReplayRun } from "@/lib/sts2-run-replay";

interface Props {
  runId: string;
  allCards: CodexCard[];
}

type Status = "loading" | "ok" | "missing" | "invalid";

function stripCardId(id: string): string {
  return id.includes(".") ? (id.split(".").pop() ?? id) : id;
}

export function RunDetailLoader({ runId, allCards }: Props) {
  const [run, setRun] = useState<ReplayRun | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (!parseRunRouteSlug(runId)) {
      setStatus("invalid");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const stored = await loadRun(runId);
        if (cancelled) return;
        if (!stored) {
          setStatus("missing");
          return;
        }
        const parsed = parseReplayRun(stored.raw);
        if (cancelled) return;
        setRun(parsed);
        setStatus("ok");
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[history-course] load failed", err);
        if (!cancelled) setStatus("missing");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  if (status === "invalid") {
    return (
      <EmptyState
        title="올바르지 않은 주소"
        message="이 URL은 저장된 런 형식이 아닙니다."
      />
    );
  }

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center text-sm text-zinc-500">
        런을 불러오는 중…
      </div>
    );
  }

  if (status === "missing" || !run) {
    return (
      <EmptyState
        title="런을 찾을 수 없습니다"
        message="이 브라우저에 저장된 런 중에 일치하는 것이 없습니다. 처음 올린 브라우저에서만 접근 가능하며, 공유 기능은 곧 추가됩니다."
      />
    );
  }

  const cardByLookupId = new Map<string, CodexCard>();
  for (const card of allCards) {
    cardByLookupId.set(card.id, card);
  }
  const relevantIds = collectRelevantCardIds(run);
  const cardsById: Record<string, CodexCard> = {};
  for (const replayId of relevantIds) {
    const stripped = stripCardId(replayId);
    const card =
      cardByLookupId.get(replayId) ?? cardByLookupId.get(stripped) ?? null;
    if (card) cardsById[replayId] = card;
  }

  return <HistoryCourseShell run={run} cardsById={cardsById} />;
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-xl font-bold text-zinc-200">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{message}</p>
      <Link
        href="/history-course"
        className="mt-6 inline-block rounded-md bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-100 ring-1 ring-zinc-700 hover:bg-zinc-700"
      >
        역사 강의서 처음으로
      </Link>
    </div>
  );
}
