"use client";

import { Shuffle } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DonatedRunSummary } from "@/lib/run-donation";
import { cn } from "@/lib/utils";

interface Props {
  runs: DonatedRunSummary[];
  userId: string | null;
}

// "?" placeholder card that picks a random shared run on click. We
// prefer runs the visitor didn't donate themselves so the user gets
// to discover others' runs; only fall back to their own when the
// pool is exclusively self-donated.
export function RandomPickCard({ runs, userId }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const onPick = () => {
    if (runs.length === 0) return;
    setPending(true);
    const others = userId
      ? runs.filter((r) => r.donor_user_id !== userId)
      : runs;
    const pool = others.length > 0 ? others : runs;
    const choice = pool[Math.floor(Math.random() * pool.length)];
    router.push(`/history-course/${choice.id}`);
  };

  const disabled = runs.length === 0 || pending;

  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      title={
        runs.length === 0
          ? "공유된 런이 아직 없습니다"
          : "공유된 런 중에서 무작위로 한 판"
      }
      className={cn(
        "group block w-full rounded-xl bg-zinc-900/60 p-3 text-left ring-1 ring-zinc-800 transition",
        disabled
          ? "cursor-not-allowed opacity-50"
          : "hover:-translate-y-0.5 hover:ring-amber-300/40",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="relative h-14 w-14 shrink-0">
          <Image
            src="/images/sts2/characters/char_select_random.webp"
            alt=""
            fill
            sizes="56px"
            className="object-contain"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-bold text-zinc-500 ring-1 ring-inset ring-zinc-700">
              ?
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-200 ring-1 ring-inset ring-amber-400/30">
              <Shuffle className="h-3 w-3" aria-hidden />
              무작위
            </span>
          </div>
          <code className="mt-1.5 block truncate rounded bg-black/30 px-1.5 py-0.5 font-mono text-[11px] text-zinc-500">
            ?
          </code>
          <div className="mt-1 text-[10px] text-zinc-600">?</div>
        </div>
      </div>
    </button>
  );
}
