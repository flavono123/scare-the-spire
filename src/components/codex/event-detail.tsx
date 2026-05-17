"use client";

import { useState, useMemo, useCallback } from "react";
import type { CSSProperties, ReactNode } from "react";
import Image from "@/components/ui/static-image";
import Link from "next/link";
import { CommentSection } from "@/components/comment-section";
import { buildCodexCommentThreadKey } from "@/lib/comment-threads";
import type { ServiceLocale } from "@/lib/i18n";
import { localizeHref } from "@/lib/i18n";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import {
  getCodexServiceMessages,
  type CodexServiceMessages,
} from "@/lib/codex-service";
import {
  CodexEvent,
  EventOption,
  EventPage,
} from "@/lib/codex-types";
import { RichText } from "@/components/rich-text";

const GAME_TEXT_SHADOW = "3px 2px 0 rgba(0,0,0,0.5), 0 0 12px rgba(0,0,0,0.75)";
const GAME_CHOICE_TEXT_SHADOW = "3px 2px 0 rgba(0,0,0,0.25)";
const GAME_CHOICE_FRAME_STYLE: CSSProperties = {
  borderStyle: "solid",
  borderWidth: "20px 54px",
  borderImageSource: "url('/images/sts2/ui/event_button.png')",
  borderImageSlice: "50 58 50 58 fill",
  borderImageRepeat: "stretch",
};
const GAME_CHOICE_GLOW_STYLE: CSSProperties = {
  ...GAME_CHOICE_FRAME_STYLE,
  filter: "brightness(1.35) saturate(1.15)",
};

function GameChoiceFrame({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  const interactive = Boolean(onClick);
  const className = `group relative block min-h-[74px] w-full overflow-visible border-0 bg-transparent p-0 text-left transition-transform duration-150 ${
    interactive ? "cursor-pointer hover:-translate-y-0.5 focus-visible:outline-none" : ""
  }`;
  const content = (
    <>
      <span
        className="pointer-events-none absolute bottom-0 left-[22px] right-0 top-0 translate-x-1 translate-y-1 opacity-35 brightness-50"
        style={GAME_CHOICE_FRAME_STYLE}
        aria-hidden
      />
      <span
        className="pointer-events-none absolute bottom-0 left-[22px] right-0 top-0 opacity-95"
        style={GAME_CHOICE_FRAME_STYLE}
        aria-hidden
      />
      <span
        className="pointer-events-none absolute -bottom-0.5 left-[20px] right-[-2px] -top-0.5 opacity-0 mix-blend-screen blur-[1px] transition-opacity duration-150 group-hover:opacity-70 group-focus-visible:opacity-80"
        style={GAME_CHOICE_GLOW_STYLE}
        aria-hidden
      />
      {interactive && (
        <span
          className="pointer-events-none absolute left-0 top-1/2 h-0 w-0 -translate-y-1/2 border-y-[18px] border-l-[28px] border-y-transparent border-l-[#f1d06b] opacity-0 drop-shadow-[2px_2px_0_rgba(0,0,0,0.55)] transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden
        />
      )}
      <div
        className="relative ml-[22px] flex min-h-[74px] flex-col justify-center px-[42px] py-[10px] pr-[46px]"
        style={{ textShadow: GAME_CHOICE_TEXT_SHADOW }}
      >
        {children}
      </div>
    </>
  );

  if (interactive) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

// --- Option card (static) ---
function OptionCard({ option }: { option: EventOption }) {
  return (
    <GameChoiceFrame>
      <div className="font-game-text text-[19px] font-bold leading-[1.05] text-[#d8cb72]">
        <RichText text={option.title} />
      </div>
      {option.description && (
        <div className="font-game-text text-[18px] leading-[1.08] text-[#fff6e2]">
          <RichText text={option.description} />
        </div>
      )}
    </GameChoiceFrame>
  );
}

// --- Navigation history entry ---
interface NavEntry {
  pageId: string;
  optionId: string;
}

// --- Resolve sequence pages (LINGER→LINGER1-9, DECIPHER→DECIPHER_1-5) ---
function resolveSequencePage(
  optionId: string,
  visitCount: number,
  pageMap: Map<string, EventPage>,
): string | null {
  if (pageMap.has(optionId)) {
    const idx = visitCount + 1;
    const underscored = `${optionId}_${idx}`;
    const suffixed = `${optionId}${idx}`;
    if (pageMap.has(underscored)) return underscored;
    if (pageMap.has(suffixed)) return suffixed;
    return optionId;
  }
  const idx = visitCount + 1;
  const candidates = [
    `${optionId}${idx}`,
    `${optionId}_${idx}`,
    `${optionId}${visitCount}`,
    `${optionId}_${visitCount}`,
  ];
  for (const c of candidates) {
    if (pageMap.has(c)) return c;
  }
  for (let i = idx - 1; i >= 1; i--) {
    if (pageMap.has(`${optionId}${i}`)) return `${optionId}${i}`;
    if (pageMap.has(`${optionId}_${i}`)) return `${optionId}_${i}`;
  }
  return null;
}

// --- Interactive event content viewer (game-like flow) ---
export function EventContentViewer({
  event,
  messages,
}: {
  event: CodexEvent;
  messages: CodexServiceMessages;
}) {
  const [history, setHistory] = useState<NavEntry[]>([]);
  const pages = useMemo(() => event.pages ?? [], [event.pages]);
  const pageMap = useMemo(
    () => new Map(pages.map((p) => [p.id, p])),
    [pages],
  );
  const allPage = pageMap.get("ALL") ?? null;

  const currentEntry = history.length > 0 ? history[history.length - 1] : null;
  const currentPageId = currentEntry?.pageId ?? null;
  const currentPage = currentPageId ? pageMap.get(currentPageId) ?? null : null;

  const description = currentPage?.description ?? event.description;

  const rawOptions = useMemo(() => {
    if (!currentPageId) return event.options ?? [];
    const page = pageMap.get(currentPageId);
    if (page?.options && page.options.length > 0) return page.options;
    if (allPage?.options && allPage.options.length > 0) return allPage.options;
    return [];
  }, [currentPageId, pageMap, event.options, allPage]);

  const options = useMemo(
    () => rawOptions.filter((o) => !o.id.endsWith("_LOCKED") && o.title !== "잠김"),
    [rawOptions],
  );

  const optionLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const opt of event.options ?? []) map.set(opt.id, opt.title);
    for (const page of pages) {
      for (const opt of page.options ?? []) map.set(opt.id, opt.title);
    }
    return map;
  }, [pages, event.options]);

  const canNavigate = useCallback(
    (optionId: string): boolean => {
      if (pageMap.has(optionId)) return true;
      if (pageMap.has(`${optionId}1`) || pageMap.has(`${optionId}_1`)) return true;
      if (pageMap.has(`${optionId}0`) || pageMap.has(`${optionId}_0`)) return true;
      return false;
    },
    [pageMap],
  );

  const navigateTo = useCallback(
    (optionId: string) => {
      const visitCount = history.filter((h) => h.optionId === optionId).length;
      const resolved = resolveSequencePage(optionId, visitCount, pageMap);
      if (!resolved) return;
      setHistory((prev) => [...prev, { pageId: resolved, optionId }]);
    },
    [history, pageMap],
  );

  const goBack = useCallback(() => {
    setHistory((prev) => prev.slice(0, -1));
  }, []);

  const reset = useCallback(() => {
    setHistory([]);
  }, []);

  const getBreadcrumbLabel = useCallback(
    (entry: NavEntry) => {
      return optionLabelMap.get(entry.optionId) ??
        optionLabelMap.get(entry.pageId) ??
        entry.pageId.replace(/_/g, " ");
    },
    [optionLabelMap],
  );

  const hasPages = pages.filter((p) => p.id !== "INITIAL").length > 0;

  return (
    <>
      {/* Description */}
      {description && (
        <div
          className="mb-3 font-game-text text-sm leading-[1.65] text-[#fff4dc] sm:text-[15px]"
          style={{ textShadow: GAME_TEXT_SHADOW }}
        >
          <RichText text={description} />
        </div>
      )}

      {/* Breadcrumb */}
      {history.length > 0 && (
        <div
          className="mb-3 flex flex-wrap items-center gap-1.5 font-game-text text-[11px]"
          style={{ textShadow: GAME_TEXT_SHADOW }}
        >
          <button
            onClick={reset}
            className="text-[#b8a98c] transition-colors hover:text-[#f0cf6a]"
          >
            {messages.eventsView.first}
          </button>
          {history.map((entry, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span className="text-[#7f715a]">›</span>
              <button
                onClick={() => setHistory((prev) => prev.slice(0, i + 1))}
                className={`transition-colors ${
                  i === history.length - 1
                    ? "font-medium text-[#f0cf6a]"
                    : "text-[#b8a98c] hover:text-[#f0cf6a]"
                }`}
              >
                {getBreadcrumbLabel(entry)}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Options */}
      {options.length > 0 && (
        <div className="space-y-2.5">
          {options.map((opt) => {
            const navigable = hasPages && canNavigate(opt.id);
            if (!navigable) return <OptionCard key={opt.id} option={opt} />;
            return (
              <GameChoiceFrame
                key={opt.id}
                onClick={() => navigateTo(opt.id)}
              >
                <div className="font-game-text text-[19px] font-bold leading-[1.05] text-[#d8cb72]">
                  <RichText text={opt.title} />
                </div>
                {opt.description && (
                  <div className="font-game-text text-[18px] leading-[1.08] text-[#fff6e2]">
                    <RichText text={opt.description} />
                  </div>
                )}
              </GameChoiceFrame>
            );
          })}
        </div>
      )}

      {/* Back button */}
      {history.length > 0 && (
        <button
          onClick={goBack}
          className="mt-3 flex items-center gap-1 font-game-text text-[11px] text-[#b8a98c] transition-colors hover:text-[#f0cf6a]"
          style={{ textShadow: GAME_TEXT_SHADOW }}
        >
          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
            <path d="M9.78 12.78a.75.75 0 01-1.06 0L4.47 8.53a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 1.06L6.06 8l3.72 3.72a.75.75 0 010 1.06z" />
          </svg>
          {messages.eventsView.previous}
        </button>
      )}
    </>
  );
}

// --- Event detail page (game-like: background art with right-side event text) ---
interface EventDetailProps {
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
  event: CodexEvent;
  onClose?: () => void;
}

export function EventDetail({ serviceLocale, event, onClose }: EventDetailProps) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={localizeHref("/compendium/events", serviceLocale)}
          className="text-sm text-gray-400 transition-colors hover:text-gray-200"
          onClick={(e) => {
            if (onClose) { e.preventDefault(); onClose(); }
          }}
        >
          ← {serviceText.eventsView.backToList}
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-white/10"
            aria-label={serviceText.common.close}
          >
            ✕
          </button>
        )}
      </div>

      <section
        className="relative overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl"
        style={{ boxShadow: `inset 0 0 120px rgba(96, 165, 250, 0.08), 0 16px 60px rgba(0, 0, 0, 0.35)` }}
      >
        <div className="relative aspect-[3440/1616] min-h-[620px] w-full sm:min-h-0">
          {event.imageUrl ? (
            <Image
              src={event.imageUrl}
              alt={event.name}
              fill
              sizes="(max-width: 768px) 100vw, 1152px"
              className="object-contain"
              priority={Boolean(onClose)}
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_35%,rgba(96,165,250,0.20),transparent_34%),linear-gradient(135deg,#111827,#050505_65%)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-l from-black/80 via-black/30 to-transparent" />
          <div className="absolute inset-x-4 bottom-4 top-4 flex min-w-0 flex-col sm:inset-x-auto sm:bottom-[6%] sm:right-[3.5%] sm:top-[7%] sm:w-[45%] sm:min-w-[380px] sm:max-w-[540px]">
            <div className="relative flex min-h-0 flex-1 flex-col">
              <div className="pointer-events-none absolute -inset-6 rounded-full bg-black/35 blur-2xl" />
              <div className="relative min-h-0 overflow-y-auto pr-2">
                <h1
                  className="font-game-title text-3xl font-bold leading-tight text-[#f3c640]"
                  style={{ textShadow: GAME_TEXT_SHADOW }}
                >
                  {event.name}
                </h1>
                <EventContentViewer event={event} messages={serviceText} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <aside className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="mb-3 text-sm font-bold text-gray-300">{serviceText.common.comments}</h2>
        <CommentSection threadKey={buildCodexCommentThreadKey("event", event.id)} />
      </aside>
    </div>
  );
}
