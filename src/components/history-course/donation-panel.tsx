"use client";

import { Check, Copy, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { donateRun, isRunDonated } from "@/lib/run-donation";
import { supabaseEnabled } from "@/lib/supabase";
import type { ReplayRun } from "@/lib/sts2-run-replay";
import { cn } from "@/lib/utils";

interface Props {
  runId: string;
  run: ReplayRun;
  raw: string;
  source: "local" | "donated";
}

export function DonationPanel({ runId, run, raw, source }: Props) {
  const { userId, ready } = useAuth();
  // We know it's donated if we loaded it from Supabase. Otherwise we
  // don't know yet — null means "checking", false/true after lookup.
  const [donated, setDonated] = useState<boolean | null>(
    source === "donated" ? true : null,
  );
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (donated !== null) return;
    let cancelled = false;
    isRunDonated(runId).then((result) => {
      if (!cancelled) setDonated(result);
    });
    return () => {
      cancelled = true;
    };
  }, [runId, donated]);

  if (!supabaseEnabled || donated === null) return null;

  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/history-course/${runId}`
      : `/history-course/${runId}`;

  const onShare = async () => {
    if (!userId) return;
    setBusy(true);
    setError(null);
    const result = await donateRun({
      runId,
      raw,
      run,
      donorUserId: userId,
    });
    setBusy(false);
    if (result.ok || result.alreadyDonated) {
      setDonated(true);
    } else {
      setError(result.message);
    }
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore — older browsers
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pt-4">
      <div
        className={cn(
          "flex flex-wrap items-center gap-3 rounded-lg px-4 py-2.5 ring-1 ring-inset",
          donated
            ? "bg-emerald-500/5 ring-emerald-400/20"
            : "bg-zinc-900/40 ring-zinc-800",
        )}
      >
        {donated ? (
          <>
            <Check className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden />
            <p className="flex-1 text-xs leading-5 text-zinc-300">
              {source === "donated"
                ? "공유 중인 런 — 이 URL로 누구나 접근할 수 있습니다."
                : "이미 익명으로 공유된 런입니다. 다른 기기에서도 같은 URL로 열립니다."}
            </p>
            <button
              type="button"
              onClick={onCopy}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition",
                copied
                  ? "bg-emerald-500/15 text-emerald-200"
                  : "bg-zinc-800 text-zinc-200 ring-1 ring-zinc-700 hover:bg-zinc-700",
              )}
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3" aria-hidden /> 복사됨
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" aria-hidden /> URL 복사
                </>
              )}
            </button>
          </>
        ) : (
          <>
            <Share2 className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
            <p className="flex-1 text-xs leading-5 text-zinc-300">
              본인 브라우저에만 저장된 런입니다. 익명으로 공유하면 누구나 이 URL로
              열 수 있어요. 시드/카드/맵만 들어있고 개인정보는 포함되지 않습니다.
            </p>
            <button
              type="button"
              onClick={onShare}
              disabled={busy || !ready || !userId}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition",
                "bg-amber-500/15 text-amber-100 ring-1 ring-amber-400/30 hover:bg-amber-500/25",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              <Share2 className="h-3 w-3" aria-hidden />
              {busy ? "공유 중…" : "익명으로 공유"}
            </button>
          </>
        )}
        {error && (
          <p className="basis-full text-xs text-red-300">{error}</p>
        )}
      </div>
    </div>
  );
}
