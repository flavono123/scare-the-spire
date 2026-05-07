"use client";

import { Check, Copy, Share2, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  deleteDonatedRun,
  donateRun,
  isOwnDonation,
  isRunDonated,
} from "@/lib/run-donation";
import { supabaseEnabled } from "@/lib/supabase";
import type { ReplayRun } from "@/lib/sts2-run-replay";
import { cn } from "@/lib/utils";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { serviceMessages } from "@/messages/service";

interface Props {
  runId: string;
  run: ReplayRun;
  raw: string;
  source: "local" | "donated";
}

export function DonationPanel({ runId, run, raw, source }: Props) {
  const copy = serviceMessages[useServiceLocale()].historyCourse.donation;
  const { userId, ready } = useAuth();
  // We know it's donated if we loaded it from Supabase. Otherwise we
  // don't know yet — null means "checking", false/true after lookup.
  const [donated, setDonated] = useState<boolean | null>(
    source === "donated" ? true : null,
  );
  // Whether the visitor is the donor on record. RLS enforces server-
  // side, but we hide the undo button for non-donors so they aren't
  // tempted to click it.
  const [isOwn, setIsOwn] = useState<boolean>(false);
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

  // Refresh ownership flag whenever the donated state or user id
  // changes (sign-in is async).
  useEffect(() => {
    if (!donated || !userId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsOwn(false);
      return;
    }
    let cancelled = false;
    isOwnDonation(runId, userId).then((result) => {
      if (!cancelled) setIsOwn(result);
    });
    return () => {
      cancelled = true;
    };
  }, [donated, runId, userId]);

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

  const onUndo = async () => {
    if (!isOwn) return;
    if (
      !window.confirm(copy.undoConfirm)
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    const ok = await deleteDonatedRun(runId);
    setBusy(false);
    if (ok) {
      setDonated(false);
      setIsOwn(false);
    } else {
      setError(copy.undoFailed);
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
                ? copy.publicOwn
                : copy.publicOther}
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
                  <Check className="h-3 w-3" aria-hidden /> {copy.copied}
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" aria-hidden /> {copy.copyUrl}
                </>
              )}
            </button>
            {isOwn && (
              <button
                type="button"
                onClick={onUndo}
                disabled={busy}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition",
                  "bg-zinc-900 text-zinc-400 ring-1 ring-zinc-800 hover:bg-red-500/10 hover:text-red-200 hover:ring-red-400/30",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                <Undo2 className="h-3 w-3" aria-hidden />
                {busy ? copy.undoing : copy.unshare}
              </button>
            )}
          </>
        ) : (
          <>
            <Share2 className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
            <p className="flex-1 text-xs leading-5 text-zinc-300">
              {copy.localInfo}
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
              {busy ? copy.sharing : copy.share}
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
