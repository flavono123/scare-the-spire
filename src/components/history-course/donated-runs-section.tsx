"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  type DonatedRunSummary,
  deleteDonatedRun,
  listRecentDonatedRuns,
} from "@/lib/run-donation";
import { supabaseEnabled } from "@/lib/supabase";
import { RandomPickCard } from "./random-pick-card";
import { RunCard } from "./run-card";

interface Props {
  refreshKey?: number;
}

export function DonatedRunsSection({ refreshKey = 0 }: Props) {
  const router = useRouter();
  const { userId } = useAuth();
  const [runs, setRuns] = useState<DonatedRunSummary[] | null>(null);

  useEffect(() => {
    if (!supabaseEnabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRuns([]);
      return;
    }
    let cancelled = false;
    listRecentDonatedRuns(100).then((result) => {
      if (!cancelled) setRuns(result);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const onUndo = async (runId: string) => {
    if (
      !window.confirm(
        "이 런의 익명 공유를 취소합니다. URL은 더 이상 다른 기기에서 열리지 않습니다.",
      )
    ) {
      return;
    }
    const ok = await deleteDonatedRun(runId);
    if (ok) {
      setRuns((prev) => prev?.filter((r) => r.id !== runId) ?? null);
    }
  };

  if (!supabaseEnabled || runs === null) {
    return null;
  }

  return (
    <section>
      <header className="mb-3">
        <h2 className="text-sm font-bold text-zinc-200">
          공유된 런{" "}
          <span className="font-medium text-zinc-500">({runs.length})</span>
        </h2>
      </header>
      <ul className="grid gap-3 sm:grid-cols-2">
        <li>
          <RandomPickCard runs={runs} userId={userId} />
        </li>
        {runs.map((entry) => {
          const isOwn = !!userId && entry.donor_user_id === userId;
          return (
            <li key={entry.id}>
              <RunCard
                runId={entry.id}
                character={entry.character}
                ascension={entry.ascension}
                build={entry.build}
                seed={entry.seed}
                win={entry.win}
                totalFloors={entry.total_floors}
                runTimeSeconds={entry.run_time}
                startTimeUnix={null}
                variant="shared"
                onPick={() => router.push(`/history-course/${entry.id}`)}
                onDelete={isOwn ? () => onUndo(entry.id) : undefined}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
