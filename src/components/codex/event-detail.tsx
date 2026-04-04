"use client";

import { useState, useMemo, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  CodexEvent,
  EventOption,
  EventPage,
  EVENT_ACT_CONFIG,
  EVENT_ACT_UNKNOWN,
} from "@/lib/codex-types";
import { RichText } from "@/components/rich-text";

// --- Stat badge (shared with other detail pages) ---
function StatBadge({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
      <span className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</span>
      <span className="text-sm font-bold" style={color ? { color } : undefined}>
        {value}
      </span>
    </div>
  );
}

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
export function EventContentViewer({ event }: { event: CodexEvent }) {
  const [history, setHistory] = useState<NavEntry[]>([]);
  const pages = event.pages ?? [];
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
            처음
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
          이전
        </button>
      )}
    </>
  );
}

// --- Event detail page ---
interface EventDetailProps {
  event: CodexEvent;
  onClose?: () => void;
}

export function EventDetail({ event, onClose }: EventDetailProps) {
  const actConfig = event.act
    ? (EVENT_ACT_CONFIG[event.act] ?? EVENT_ACT_UNKNOWN)
    : EVENT_ACT_UNKNOWN;

  return (
    <div className="flex flex-col items-center gap-6 p-4 sm:p-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <Link
          href="/codex/events"
          className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
          onClick={(e) => {
            if (onClose) {
              e.preventDefault();
              onClose();
            }
          }}
        >
          ← 이벤트
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-gray-400"
            aria-label="닫기"
          >
            ✕
          </button>
        )}
      </div>

      {/* Event art */}
      {event.imageUrl && (
        <div className="w-full aspect-[16/9] relative rounded-lg overflow-hidden">
          <Image
            src={event.imageUrl}
            alt={event.name}
            fill
            sizes="(max-width: 512px) 100vw, 512px"
            className="object-cover"
          />
        </div>
      )}

      {/* Name */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-100">{event.name}</h1>
        <p className="text-sm text-gray-500">{event.nameEn}</p>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap justify-center gap-2">
        <StatBadge
          label="막"
          value={actConfig.labelKo}
          color={actConfig.color.includes("green") ? "#4ade80"
            : actConfig.color.includes("orange") ? "#fb923c"
            : actConfig.color.includes("yellow") ? "#facc15"
            : actConfig.color.includes("zinc") ? "#a1a1aa"
            : undefined}
        />
      </div>

      {/* Interactive content */}
      <div className="w-full bg-white/5 border border-white/10 rounded-lg p-4">
        <EventContentViewer event={event} />
      </div>
    </div>
  );
}
