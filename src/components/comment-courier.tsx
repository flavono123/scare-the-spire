"use client";

import { useEffect, useState } from "react";
import Image from "@/components/ui/static-image";
import Link from "next/link";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { commentThreadHref } from "@/lib/comment-threads";
import { COLORFUL_PHILOSOPHERS_TOKEN_SRC } from "@/lib/colorful-philosophers";
import { DECISIONS_DECISIONS_TOKEN_SRC } from "@/lib/decisions-decisions";
import { DEFRAGMENT_TOKEN_SRC } from "@/lib/defragment";
import { FAVORITE_TOURNAMENT_TOKEN_SRC } from "@/lib/favorite-tournament";
import { localizeHref } from "@/lib/i18n";
import { PAGESTORM_TOKEN_SRC } from "@/lib/pagestorm";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { serviceMessages } from "@/messages/service";

const STORAGE_KEY = "sts-courier-enabled";
const CHANGE_EVENT = "sts-courier-change";
const WINDOW_MS = 6 * 60 * 60 * 1000;
const LIMIT = 12;
const ROTATE_MS = 8000;

type CourierItem = {
  id: string;
  storyId: string;
  text: string;
  source: string;
  token: string | null;
  href: string;
};

const SERVICE_TOKENS: Record<string, { ko: string; en: string; token: string }> = {
  "colorful-philosophers:": { ko: "다채로운 철학자들", en: "Colorful Philosophers", token: COLORFUL_PHILOSOPHERS_TOKEN_SRC },
  "c-c-c-combo:": { ko: "코오오옴보", en: "Combo", token: "/images/sts2/badges/ccccombo.webp" },
  "transfigure:": { ko: "변형", en: "Transfigure", token: "/images/sts2/relics/astrolabe.webp" },
  "chemical-x:": { ko: "케미컬X", en: "Chemical X", token: "/images/sts2/relics/chemical_x.webp" },
  "this-or-that:": { ko: "이거 아님 저거?", en: "This or That", token: "/images/sts2/relics/choices_paradox.webp" },
  "favorite-tournament:": { ko: "이아저? 월드컵", en: "Favorite Tournament", token: FAVORITE_TOURNAMENT_TOKEN_SRC },
  "decisions-decisions:": { ko: "어려운 결정", en: "Decisions, Decisions", token: DECISIONS_DECISIONS_TOKEN_SRC },
  "pagestorm:": { ko: "페이지스톰", en: "Pagestorm", token: PAGESTORM_TOKEN_SRC },
  "defragment:": { ko: "조각모음", en: "Defragment", token: DEFRAGMENT_TOKEN_SRC },
};

export function readCourierEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(STORAGE_KEY) !== "0";
}

export function writeCourierEnabled(enabled: boolean) {
  window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function plainComment(content: string): string {
  return content.replace(/\[[^\]]+\]/g, " ").replace(/\s+/g, " ").trim();
}

function describe(storyId: string, locale: "ko" | "en"): { source: string; token: string | null } {
  if (storyId.startsWith("community:") || storyId.startsWith("story:")) {
    return { source: locale === "ko" ? "슬서운이야기" : "Stories", token: null };
  }
  if (storyId.startsWith("neowsletter:")) {
    return { source: locale === "ko" ? "니오우스레터" : "Neowsletter", token: null };
  }
  if (storyId.startsWith("sts2-patch:")) {
    return { source: locale === "ko" ? "패치노트" : "Patch notes", token: null };
  }
  if (storyId.startsWith("sts2-codex:") || storyId.startsWith("sts1-codex:")) {
    return { source: locale === "ko" ? "백과사전" : "Compendium", token: null };
  }
  for (const [prefix, meta] of Object.entries(SERVICE_TOKENS)) {
    if (storyId.startsWith(prefix)) return { source: locale === "ko" ? meta.ko : meta.en, token: meta.token };
  }
  return { source: locale === "ko" ? "댓글" : "Comment", token: null };
}

function commentHref(storyId: string, commentId: string): string {
  const base = commentThreadHref(storyId);
  if (base.includes("#") && !base.endsWith("#comments")) return base;
  return `${base.replace(/#comments$/, "")}#history-comment-${commentId}`;
}

export function CommentCourier() {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].profile.courier;
  const [enabled, setEnabled] = useState(true);
  const [items, setItems] = useState<CourierItem[]>([]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const sync = () => setEnabled(readCourierEnabled());
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    if (!enabled || !supabaseEnabled) return;
    let cancelled = false;
    const load = () => {
      const since = new Date(Date.now() - WINDOW_MS).toISOString();
      supabase.from("comments")
        .select("id, story_id, content, created_at")
        .eq("env", supabaseEnv)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(LIMIT)
        .then(({ data }) => {
          if (cancelled) return;
          const next = (data ?? []).flatMap((row) => {
            const id = String(row.id ?? "");
            const storyId = String(row.story_id ?? "");
            const text = plainComment(String(row.content ?? ""));
            if (!id || !storyId || !text) return [];
            const described = describe(storyId, serviceLocale);
            return [{
              id,
              storyId,
              text,
              source: described.source,
              token: described.token,
              href: localizeHref(commentHref(storyId, id), serviceLocale),
            }];
          });
          setItems(next);
          setIndex(0);
        });
    };
    load();
    const timer = window.setInterval(load, 3 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled, serviceLocale]);

  useEffect(() => {
    if (!enabled || paused || items.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      setIndex((current) => (current + 1) % items.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [enabled, paused, items.length]);

  if (!enabled) {
    return (
      <button
        type="button"
        onClick={() => writeCourierEnabled(true)}
        className="fixed bottom-3 left-3 z-40 rounded-full border border-white/10 bg-black/70 px-2 py-1 text-[10px] text-zinc-400"
      >
        {copy.label}
      </button>
    );
  }

  const item = items[index];
  if (!item) return null;

  return (
    <div
      className="fixed bottom-3 left-3 z-40 flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-full border border-white/10 bg-black/75 px-2 py-1 text-xs text-zinc-300 sm:max-w-md"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <Link href={item.href} className="flex min-w-0 items-center gap-1.5">
        <span className="shrink-0 text-[10px] text-zinc-500">{item.source}</span>
        {item.token ? <Image src={item.token} alt="" width={14} height={14} className="h-3.5 w-3.5 object-contain" /> : null}
        <span className="truncate">{item.text}</span>
      </Link>
      <button
        type="button"
        aria-label={copy.hide}
        onClick={() => writeCourierEnabled(false)}
        className="shrink-0 px-1 text-zinc-500"
      >
        ×
      </button>
    </div>
  );
}
