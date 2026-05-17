"use client";

import { useState, useMemo, useCallback } from "react";
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
  EVENT_ACT_UNKNOWN,
} from "@/lib/codex-types";
import { RichText } from "@/components/rich-text";

const EVENT_ACT_COLOR = "#60a5fa";

// --- Option card (static) ---
function OptionCard({ option }: { option: EventOption }) {
  return (
    <div className="rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2">
      <div className="mb-0.5 text-xs font-semibold text-amber-400">
        {option.title}
      </div>
      {option.description && (
        <div className="text-xs leading-relaxed text-zinc-300">
          <RichText text={option.description} />
        </div>
      )}
    </div>
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
        <div className="text-sm leading-[1.85] text-gray-200 mb-4">
          <RichText text={description} />
        </div>
      )}

      {/* Breadcrumb */}
      {history.length > 0 && (
        <div className="flex items-center gap-1.5 mb-2 text-[10px] flex-wrap">
          <button
            onClick={reset}
            className="text-zinc-500 hover:text-yellow-400 transition-colors"
          >
            {messages.eventsView.first}
          </button>
          {history.map((entry, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span className="text-zinc-600">›</span>
              <button
                onClick={() => setHistory((prev) => prev.slice(0, i + 1))}
                className={`transition-colors ${
                  i === history.length - 1
                    ? "text-yellow-400 font-medium"
                    : "text-zinc-500 hover:text-yellow-400"
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
        <div className="space-y-1.5">
          {options.map((opt) => {
            const navigable = hasPages && canNavigate(opt.id);
            if (!navigable) return <OptionCard key={opt.id} option={opt} />;
            return (
              <button
                key={opt.id}
                onClick={() => navigateTo(opt.id)}
                className="w-full text-left rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2 hover:border-amber-400/40 hover:bg-amber-500/10 transition-all cursor-pointer group"
              >
                <div className="mb-0.5 text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                  {opt.title}
                  <svg
                    className="w-3 h-3 text-amber-500/50 group-hover:text-amber-400 transition-colors"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                  >
                    <path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" />
                  </svg>
                </div>
                {opt.description && (
                  <div className="text-xs leading-relaxed text-zinc-300">
                    <RichText text={opt.description} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Back button */}
      {history.length > 0 && (
        <button
          onClick={goBack}
          className="mt-2 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
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

// --- Act badge ---
function ActBadge({
  act,
  messages,
  gameUi,
}: {
  act: CodexEvent["act"];
  messages: CodexServiceMessages;
  gameUi: CodexGameUiLabels;
}) {
  const label = act ? gameUi.acts[act] : messages.labels.acts.none;
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium ${
        act
          ? "border-blue-500/40 bg-blue-500/10 text-blue-300"
          : `${EVENT_ACT_UNKNOWN.color} ${EVENT_ACT_UNKNOWN.border} ${EVENT_ACT_UNKNOWN.bg}`
      }`}
    >
      {label}
    </span>
  );
}

// --- Event detail page (game-like: image left, content right) ---
interface EventDetailProps {
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
  event: CodexEvent;
  onClose?: () => void;
}

export function EventDetail({ serviceLocale, gameUi, event, onClose }: EventDetailProps) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 p-4 sm:p-6">
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

      {event.imageUrl && (
        <div
          className="relative overflow-hidden rounded-xl border border-white/10 bg-black/40"
          style={{ boxShadow: `inset 0 0 120px rgba(96, 165, 250, 0.08), 0 16px 60px rgba(0, 0, 0, 0.25)` }}
        >
          <div className="relative aspect-[3440/1616] w-full">
            <Image
              src={event.imageUrl}
              alt={event.name}
              fill
              sizes="(max-width: 768px) 100vw, 960px"
              className="object-contain"
              priority={Boolean(onClose)}
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="min-w-0 rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-game-title text-2xl font-bold leading-tight text-yellow-400 sm:text-3xl">
                {event.name}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="font-game-text text-sm text-zinc-500">{event.nameEn}</span>
                <ActBadge act={event.act} messages={serviceText} gameUi={gameUi} />
              </div>
            </div>
            <span
              className="hidden h-10 w-1.5 shrink-0 rounded-full sm:block"
              style={{ backgroundColor: event.act ? EVENT_ACT_COLOR : "#71717a" }}
            />
          </div>

          <EventContentViewer event={event} messages={serviceText} />
        </section>

        <aside className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="mb-3 text-sm font-bold text-gray-300">{serviceText.common.comments}</h2>
          <CommentSection threadKey={buildCodexCommentThreadKey("event", event.id)} />
        </aside>
      </div>
    </div>
  );
}
