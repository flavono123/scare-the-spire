"use client";

import Image from "next/image";
import Link from "next/link";
import type { CodexAncient } from "@/lib/codex-types";
import {
  EVENT_ACT_CONFIG,
  EVENT_ACT_UNKNOWN,
  EventAct,
} from "@/lib/codex-types";

function ActBadge({ act }: { act: EventAct | null }) {
  const config = act
    ? (EVENT_ACT_CONFIG[act] ?? EVENT_ACT_UNKNOWN)
    : EVENT_ACT_UNKNOWN;
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium ${config.color} ${config.border} ${config.bg}`}
    >
      {config.labelKo}
    </span>
  );
}

interface AncientListProps {
  ancients: CodexAncient[];
}

export function AncientList({ ancients }: AncientListProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-yellow-900/30 bg-[#0d0d14]">
        <div className="mx-auto max-w-5xl px-6 py-8 text-center">
          <h1 className="font-[family-name:var(--font-gc-batang)] text-3xl md:text-4xl text-yellow-500 mb-2">
            에인션트
          </h1>
          <p className="text-sm text-yellow-200/40">
            첨탑에 깃든 고대의 존재들 — {ancients.length}
          </p>
        </div>
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {ancients.map((ancient) => (
            <AncientCard
              key={ancient.id}
              ancient={ancient}
              relicCount={ancient.relicIds.length}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function AncientCard({
  ancient,
  relicCount,
}: {
  ancient: CodexAncient;
  relicCount: number;
}) {
  return (
    <Link
      href={`/codex/ancients/${ancient.id.toLowerCase()}`}
      className="group relative overflow-hidden rounded-xl border border-blue-900/30 bg-[#12121a] hover:border-blue-600/50 transition-all duration-200"
    >
      {/* Image */}
      <div className="relative w-full aspect-square overflow-hidden">
        {ancient.imageUrl && (
          <Image
            src={ancient.imageUrl}
            alt={ancient.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover object-top group-hover:scale-105 transition-transform duration-300"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#12121a] via-transparent to-transparent" />
      </div>

      {/* Text */}
      <div className="relative px-4 pb-4 -mt-8">
        <h2 className="font-[family-name:var(--font-gc-batang)] text-lg text-blue-300 group-hover:text-blue-200 transition-colors">
          {ancient.name}
        </h2>
        <p className="text-[11px] text-blue-400/50 mt-0.5">{ancient.nameEn}</p>
        <p className="text-xs text-zinc-400 mt-1 italic">{ancient.epithet}</p>
        <div className="flex items-center gap-2 mt-2">
          <ActBadge act={ancient.act} />
          <span className="text-[10px] text-zinc-500">
            유물 {relicCount}개
          </span>
        </div>
      </div>
    </Link>
  );
}
