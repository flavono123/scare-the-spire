"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CommentSection } from "@/components/comment-section";
import { buildCodexCommentThreadKey } from "@/lib/comment-threads";
import type { CodexAncient, CodexRelic, AncientDialogueLine } from "@/lib/codex-types";
import {
  EVENT_ACT_CONFIG,
  EVENT_ACT_UNKNOWN,
  CHARACTER_COLORS,
} from "@/lib/codex-types";
import { RichText } from "@/components/rich-text";

// Character tab config
const CHARACTERS = [
  { key: "Ironclad", label: "아이언클래드", color: CHARACTER_COLORS.ironclad },
  { key: "Silent", label: "사일런트", color: CHARACTER_COLORS.silent },
  { key: "Defect", label: "디펙트", color: CHARACTER_COLORS.defect },
  { key: "Necrobinder", label: "네크로바인더", color: CHARACTER_COLORS.necrobinder },
  { key: "Regent", label: "리젠트", color: CHARACTER_COLORS.regent },
] as const;

const SPECIAL_TABS = [
  { key: "First Visit", label: "첫 방문" },
  { key: "Returning", label: "재방문" },
] as const;

// --- Dialogue viewer ---
function DialogueViewer({ dialogue, ancientName }: { dialogue: Record<string, AncientDialogueLine[]>; ancientName: string }) {
  const [activeTab, setActiveTab] = useState("Ironclad");

  const lines = dialogue[activeTab] ?? [];

  return (
    <div>
      {/* Character tabs */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {CHARACTERS.map((ch) => {
          const hasLines = (dialogue[ch.key]?.length ?? 0) > 0;
          if (!hasLines) return null;
          return (
            <button
              key={ch.key}
              onClick={() => setActiveTab(ch.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                activeTab === ch.key
                  ? "border-current bg-current/10"
                  : "border-zinc-700/40 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600"
              }`}
              style={activeTab === ch.key ? { color: ch.color, borderColor: ch.color } : undefined}
            >
              {ch.label}
            </button>
          );
        })}
        <div className="w-px bg-zinc-700/40 mx-1" />
        {SPECIAL_TABS.map((tab) => {
          const hasLines = (dialogue[tab.key]?.length ?? 0) > 0;
          if (!hasLines) return null;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                activeTab === tab.key
                  ? "border-blue-500/50 text-blue-400 bg-blue-500/10"
                  : "border-zinc-700/40 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Dialogue lines */}
      <div className="space-y-3">
        {lines.map((line, i) => {
          const isAncient = line.speaker === "ancient";
          const charConfig = CHARACTERS.find((c) => c.key === activeTab);
          return (
            <div
              key={`${activeTab}-${i}`}
              className={`flex gap-3 ${isAncient ? "" : "justify-end"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                  isAncient
                    ? "bg-blue-500/10 border border-blue-500/20 text-blue-100"
                    : "bg-zinc-800/80 border border-zinc-700/40 text-zinc-300"
                }`}
              >
                <div className="text-[10px] font-medium mb-1 opacity-60">
                  {isAncient ? ancientName : charConfig?.label ?? activeTab}
                </div>
                <RichText text={line.text} />
              </div>
            </div>
          );
        })}
        {lines.length === 0 && (
          <p className="text-sm text-zinc-600 italic">대사 데이터가 없습니다.</p>
        )}
      </div>
    </div>
  );
}

// --- Relic grid ---
function RelicGrid({ relics }: { relics: CodexRelic[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {relics.map((relic) => (
        <Link
          key={relic.id}
          href={`/codex/relics?relic=${relic.id}`}
          className="group flex flex-col items-center gap-2 rounded-lg border border-zinc-700/30 bg-zinc-900/50 p-3 hover:border-yellow-700/40 hover:bg-zinc-800/50 transition-all"
        >
          {relic.imageUrl && (
            <div className="relative w-12 h-12">
              <Image
                src={relic.imageUrl}
                alt={relic.name}
                fill
                sizes="48px"
                className="object-contain drop-shadow-[0_0_6px_rgba(255,215,0,0.2)]"
              />
            </div>
          )}
          <span className="text-xs text-center text-zinc-300 group-hover:text-yellow-300 transition-colors leading-tight">
            {relic.name}
          </span>
          <span className="text-[10px] text-zinc-600">{relic.rarity}</span>
        </Link>
      ))}
    </div>
  );
}

// --- Main component ---
interface AncientDetailProps {
  ancient: CodexAncient;
  relics: CodexRelic[];
}

export function AncientDetail({ ancient, relics }: AncientDetailProps) {
  const actConfig = ancient.act
    ? (EVENT_ACT_CONFIG[ancient.act] ?? EVENT_ACT_UNKNOWN)
    : EVENT_ACT_UNKNOWN;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero section */}
      <div className="relative border-b border-blue-900/30 bg-[#0d0d14] overflow-hidden">
        {/* Background blur */}
        {ancient.imageUrl && (
          <div className="absolute inset-0">
            <Image
              src={ancient.imageUrl}
              alt=""
              fill
              sizes="100vw"
              className="object-cover opacity-15 blur-2xl scale-110"
            />
          </div>
        )}

        <div className="relative mx-auto max-w-4xl px-6 py-8">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* Portrait */}
            {ancient.imageUrl && (
              <div className="relative w-48 h-48 md:w-56 md:h-56 flex-shrink-0 rounded-xl overflow-hidden border border-blue-500/20">
                <Image
                  src={ancient.imageUrl}
                  alt={ancient.name}
                  fill
                  sizes="224px"
                  className="object-cover object-top"
                />
              </div>
            )}

            {/* Info */}
            <div className="flex-1">
              <Link
                href="/codex/ancients"
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors mb-2 inline-block"
              >
                ← 에인션트 목록
              </Link>
              <h1 className="font-[family-name:var(--font-gc-batang)] text-3xl text-blue-300 mb-1">
                {ancient.name}
              </h1>
              <p className="text-sm text-blue-400/50 mb-2">{ancient.nameEn}</p>
              <p className="text-sm text-zinc-400 italic mb-3">&ldquo;{ancient.epithet}&rdquo;</p>

              {/* Badges */}
              <div className="flex items-center gap-2 mb-4">
                <span
                  className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium ${actConfig.color} ${actConfig.border} ${actConfig.bg}`}
                >
                  {actConfig.labelKo}
                </span>
                <span className="text-[10px] text-zinc-500">
                  유물 {ancient.relicIds.length}개
                </span>
              </div>

              {/* Description */}
              <div className="text-sm leading-relaxed text-zinc-300">
                <RichText text={ancient.description} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content sections */}
      <div className="mx-auto max-w-4xl px-6 py-8 space-y-10">
        {/* Dialogue */}
        <section>
          <h2 className="font-[family-name:var(--font-gc-batang)] text-xl text-blue-300 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500/60" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5zm12 0a2 2 0 012-2h1a2 2 0 012 2v4a2 2 0 01-2 2h-1l-2 2v-2a2 2 0 01-2-2V5h2z" clipRule="evenodd" />
            </svg>
            대사
          </h2>
          <DialogueViewer dialogue={ancient.dialogue} ancientName={ancient.name} />
        </section>

        {/* Relics */}
        {relics.length > 0 && (
          <section>
            <h2 className="font-[family-name:var(--font-gc-batang)] text-xl text-blue-300 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-yellow-500/60" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              보상 유물
            </h2>
            <RelicGrid relics={relics} />
          </section>
        )}

        <section>
          <h2 className="font-[family-name:var(--font-gc-batang)] text-xl text-blue-300 mb-4">댓글</h2>
          <div className="rounded-xl border border-blue-900/30 bg-[#101018] p-4">
            <CommentSection threadKey={buildCodexCommentThreadKey("ancient", ancient.id)} />
          </div>
        </section>
      </div>
    </div>
  );
}
