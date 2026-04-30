"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  type DonatedRunSummary,
  listRecentDonatedRuns,
} from "@/lib/run-donation";
import { isBuildSupported } from "@/lib/sts2-build-version";
import { supabaseEnabled } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const CHARACTER_META: Record<
  string,
  { ko: string; ring: string; text: string; icon: string }
> = {
  "CHARACTER.IRONCLAD": {
    ko: "아이언클래드",
    ring: "ring-red-400/30",
    text: "text-red-300",
    icon: "/images/sts2/icons/ironclad_energy_icon.webp",
  },
  "CHARACTER.SILENT": {
    ko: "사일런트",
    ring: "ring-emerald-400/30",
    text: "text-emerald-300",
    icon: "/images/sts2/icons/silent_energy_icon.webp",
  },
  "CHARACTER.DEFECT": {
    ko: "디펙트",
    ring: "ring-cyan-400/30",
    text: "text-cyan-300",
    icon: "/images/sts2/icons/defect_energy_icon.webp",
  },
  "CHARACTER.NECROBINDER": {
    ko: "네크로바인더",
    ring: "ring-pink-400/30",
    text: "text-pink-300",
    icon: "/images/sts2/icons/necrobinder_energy_icon.webp",
  },
  "CHARACTER.REGENT": {
    ko: "리젠트",
    ring: "ring-orange-400/30",
    text: "text-orange-300",
    icon: "/images/sts2/icons/regent_energy_icon.webp",
  },
};

const UNKNOWN_META = {
  ko: "?",
  ring: "ring-zinc-700",
  text: "text-zinc-300",
  icon: "/images/sts2/icons/star_icon.webp",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function DonatedRunsSection() {
  const [runs, setRuns] = useState<DonatedRunSummary[] | null>(null);

  useEffect(() => {
    if (!supabaseEnabled) {
      setRuns([]);
      return;
    }
    let cancelled = false;
    listRecentDonatedRuns(12).then((result) => {
      if (!cancelled) setRuns(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!supabaseEnabled || runs === null || runs.length === 0) {
    return null;
  }

  return (
    <section className="mt-12">
      <header className="mb-3">
        <h2 className="text-lg font-bold text-zinc-100">공유된 런</h2>
        <p className="text-xs text-zinc-500">
          다른 사람이 익명으로 공유한 최근 런입니다. 클릭해서 그대로 다시
          따라가볼 수 있어요.
        </p>
      </header>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {runs.map((entry) => {
          const meta = CHARACTER_META[entry.character] ?? UNKNOWN_META;
          const supported = isBuildSupported(entry.build);
          return (
            <li key={entry.id}>
              <Link
                href={`/history-course/${entry.id}`}
                prefetch={false}
                className={cn(
                  "group block rounded-xl bg-zinc-900/60 p-3 ring-1 ring-inset transition hover:-translate-y-0.5 hover:ring-amber-300/40",
                  meta.ring,
                )}
              >
                <div className="flex items-start gap-3">
                  <Image
                    src={meta.icon}
                    alt=""
                    width={32}
                    height={32}
                    className="h-8 w-8 shrink-0 object-contain"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("text-xs font-bold", meta.text)}>
                        {meta.ko}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                          entry.win
                            ? "bg-amber-500/15 text-amber-200"
                            : "bg-zinc-800 text-zinc-400",
                        )}
                      >
                        {entry.win ? "정상" : "도중 사망"}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-zinc-400">
                      <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-zinc-300">
                        {entry.seed}
                      </code>
                      <span>승천 {entry.ascension}</span>
                      <span className="text-zinc-600">·</span>
                      <span
                        className={
                          supported ? "text-zinc-400" : "text-red-300"
                        }
                      >
                        {entry.build}
                      </span>
                    </div>
                    <div className="mt-1 text-[10px] text-zinc-500">
                      {formatDate(entry.created_at)} · {entry.acts_count}막
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
