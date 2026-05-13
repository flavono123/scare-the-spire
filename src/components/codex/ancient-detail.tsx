"use client";

import { useState } from "react";
import Image from "@/components/ui/static-image";
import Link from "next/link";
import { CommentSection } from "@/components/comment-section";
import { buildCodexCommentThreadKey } from "@/lib/comment-threads";
import type { ServiceLocale } from "@/lib/i18n";
import { localizeHref } from "@/lib/i18n";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import {
  formatTemplateCount,
  getCodexServiceMessages,
  type CodexServiceMessages,
} from "@/lib/codex-service";
import type { CodexAncient, CodexRelic, AncientDialogueLine } from "@/lib/codex-types";
import {
  EVENT_ACT_CONFIG,
  EVENT_ACT_UNKNOWN,
  CHARACTER_COLORS,
} from "@/lib/codex-types";
import { RichText } from "@/components/rich-text";

const CHARACTERS = [
  { key: "Ironclad", pool: "ironclad", color: CHARACTER_COLORS.ironclad },
  { key: "Silent", pool: "silent", color: CHARACTER_COLORS.silent },
  { key: "Defect", pool: "defect", color: CHARACTER_COLORS.defect },
  { key: "Necrobinder", pool: "necrobinder", color: CHARACTER_COLORS.necrobinder },
  { key: "Regent", pool: "regent", color: CHARACTER_COLORS.regent },
] as const;

const SPECIAL_TABS = [
  { key: "First Visit", labelKey: "firstVisit" },
  { key: "Returning", labelKey: "returning" },
] as const;

// --- Dialogue viewer ---
function DialogueViewer({
  dialogue,
  ancientName,
  messages,
}: {
  dialogue: Record<string, AncientDialogueLine[]>;
  ancientName: string;
  messages: CodexServiceMessages;
}) {
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
              {messages.labels.pools[ch.pool]}
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
              {messages.ancientsView[tab.labelKey]}
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
                  {isAncient ? ancientName : charConfig ? messages.labels.pools[charConfig.pool] : activeTab}
                </div>
                <RichText text={line.text} />
              </div>
            </div>
          );
        })}
        {lines.length === 0 && (
          <p className="text-sm text-zinc-600 italic">{messages.ancientsView.noDialogue}</p>
        )}
      </div>
    </div>
  );
}

// --- Relic grid ---
function RelicGrid({
  relics,
  serviceLocale,
  gameUi,
}: {
  relics: CodexRelic[];
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {relics.map((relic) => (
        <Link
          key={relic.id}
          href={localizeHref(`/compendium/relics?relic=${relic.id}`, serviceLocale)}
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
          <span className="text-[10px] text-zinc-600">{gameUi.relicCollection.rarities[relic.rarity].label}</span>
        </Link>
      ))}
    </div>
  );
}

// --- Main component ---
interface AncientDetailProps {
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
  ancient: CodexAncient;
  relics: CodexRelic[];
}

export function AncientDetail({ serviceLocale, gameUi, ancient, relics }: AncientDetailProps) {
  const serviceText = getCodexServiceMessages(serviceLocale);
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
                href={localizeHref("/compendium/ancients", serviceLocale)}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors mb-2 inline-block"
              >
                ← {serviceText.ancientsView.backToList}
              </Link>
              <h1 className="font-game-title text-3xl text-blue-300 mb-1">
                {ancient.name}
              </h1>
              <p className="text-sm text-blue-400/50 mb-2">{ancient.nameEn}</p>
              <p className="text-sm text-zinc-400 italic mb-3">&ldquo;{ancient.epithet}&rdquo;</p>

              {/* Badges */}
              <div className="flex items-center gap-2 mb-4">
                <span
                  className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium ${actConfig.color} ${actConfig.border} ${actConfig.bg}`}
                >
                  {ancient.act ? gameUi.acts[ancient.act] : serviceText.labels.acts.none}
                </span>
                <span className="text-[10px] text-zinc-500">
                  {formatTemplateCount(serviceText.ancientsView.relicCount, ancient.relicIds.length)}
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
          <h2 className="font-service text-xl text-blue-300 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500/60" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5zm12 0a2 2 0 012-2h1a2 2 0 012 2v4a2 2 0 01-2 2h-1l-2 2v-2a2 2 0 01-2-2V5h2z" clipRule="evenodd" />
            </svg>
            {serviceText.ancientsView.dialogue}
          </h2>
          <DialogueViewer dialogue={ancient.dialogue} ancientName={ancient.name} messages={serviceText} />
        </section>

        {/* Relics */}
        {relics.length > 0 && (
          <section>
            <h2 className="font-service text-xl text-blue-300 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-yellow-500/60" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              {serviceText.ancientsView.rewardRelics}
            </h2>
            <RelicGrid relics={relics} serviceLocale={serviceLocale} gameUi={gameUi} />
          </section>
        )}

        <section>
          <h2 className="font-service text-xl text-blue-300 mb-4">{serviceText.common.comments}</h2>
          <div className="rounded-xl border border-blue-900/30 bg-[#101018] p-4">
            <CommentSection threadKey={buildCodexCommentThreadKey("ancient", ancient.id)} />
          </div>
        </section>
      </div>
    </div>
  );
}
