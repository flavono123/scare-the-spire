"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import Image from "@/components/ui/static-image";
import Link from "next/link";
import { GameUiHoverTip } from "@/components/game-ui-hover-tip";
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
const WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const LIMIT = 12;
const ROTATE_MS = 8000;

type CourierItem = {
  id: string;
  storyId: string;
  text: string;
  source: string;
  token: string;
  href: string;
};

export const COURIER_TOKEN_SRC = "/images/sts2/relics/the_courier.webp";

const CODEX_TOKENS: Record<string, { ko: string; en: string; token: string }> = {
  card: { ko: "카드", en: "Card", token: "/images/sts2/nav/stats_cards.png" },
  relic: { ko: "유물", en: "Relic", token: "/images/sts2/relics/bing_bong.webp" },
  potion: { ko: "물약", en: "Potion", token: "/images/sts2/potions/potion_shaped_rock.webp" },
  power: { ko: "파워", en: "Power", token: "/images/sts2/nav/unmovable_power_beta.webp" },
  enchantment: { ko: "인챈트", en: "Enchantment", token: "/images/sts2/enchantments/souls_power.webp" },
  monster: { ko: "몬스터", en: "Monster", token: "/images/sts2/nav/happy_cultist.png" },
  event: { ko: "이벤트", en: "Event", token: "/images/sts2/nav/question_mark.png" },
  ancient: { ko: "고대", en: "Ancient", token: "/images/sts2/nav/stats_ancients.png" },
  epoch: { ko: "시대", en: "Epoch", token: "/images/sts2/relics/planisphere.webp" },
  character: { ko: "캐릭터", en: "Character", token: "/images/sts2/characters/character_icon_ironclad.webp" },
  keyword: { ko: "키워드", en: "Keyword", token: "/images/sts2/ui/topbar/submenu_history_icon.png" },
  badge: { ko: "배지", en: "Badge", token: "/images/sts2/badges/double_snecko.webp" },
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
  "history-course:": { ko: "역사 강의서", en: "History Course", token: "/images/sts2/relics/history_course.webp" },
};

export function courierSourceCatalog(locale: "ko" | "en") {
  const fixed = [
    { id: "stories", label: locale === "ko" ? "슬서운이야기" : "Stories", token: "/images/bone_tea.png" },
    { id: "patch", label: locale === "ko" ? "패치노트" : "Patch notes", token: "/images/sts2/nav/patch_notes_icon.png" },
    { id: "neowsletter", label: locale === "ko" ? "니오우스레터" : "Neowsletter", token: "/images/sts2/ancients/neow.webp" },
  ];
  const services = Object.entries(SERVICE_TOKENS).map(([id, meta]) => ({
    id,
    label: locale === "ko" ? meta.ko : meta.en,
    token: meta.token,
  }));
  const codex = Object.entries(CODEX_TOKENS).map(([id, meta]) => ({
    id: `codex:${id}`,
    label: locale === "ko" ? meta.ko : meta.en,
    token: meta.token,
  }));
  return [...fixed, ...services, ...codex];
}

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

function describe(storyId: string, locale: "ko" | "en"): { source: string; token: string } {
  if (storyId.startsWith("community:") || storyId.startsWith("story:")) {
    return { source: locale === "ko" ? "슬서운이야기" : "Stories", token: "/images/bone_tea.png" };
  }
  if (storyId.startsWith("neowsletter:")) {
    return { source: locale === "ko" ? "니오우스레터" : "Neowsletter", token: "/images/sts2/ancients/neow.webp" };
  }
  if (storyId.startsWith("sts2-patch:")) {
    return { source: locale === "ko" ? "패치노트" : "Patch notes", token: "/images/sts2/nav/patch_notes_icon.png" };
  }
  const codex = /^(?:sts2-codex|sts1-codex):([^:]+):/.exec(storyId);
  if (codex) {
    const meta = CODEX_TOKENS[codex[1]] ?? CODEX_TOKENS.card;
    return { source: locale === "ko" ? meta.ko : meta.en, token: meta.token };
  }
  for (const [prefix, meta] of Object.entries(SERVICE_TOKENS)) {
    if (storyId.startsWith(prefix)) return { source: locale === "ko" ? meta.ko : meta.en, token: meta.token };
  }
  return { source: locale === "ko" ? "댓글" : "Comment", token: COURIER_TOKEN_SRC };
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
  const [known, setKnown] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [items, setItems] = useState<CourierItem[]>([]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useLayoutEffect(() => {
    setEnabled(readCourierEnabled());
    setKnown(true);
  }, []);

  useEffect(() => {
    const sync = () => setEnabled(readCourierEnabled());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    if (!known || !enabled || !supabaseEnabled) return;
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
          setLoaded(true);
        });
    };
    load();
    const timer = window.setInterval(load, 3 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [known, enabled, serviceLocale]);

  useEffect(() => {
    if (!enabled || paused || items.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      setIndex((current) => (current + 1) % items.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [enabled, paused, items.length]);

  if (!known || (enabled && !loaded)) {
    return (
      <div
        aria-busy="true"
        className="fixed bottom-3 left-3 z-40 h-8 w-56 animate-pulse rounded-full border border-white/10 bg-white/10"
      />
    );
  }

  if (!enabled) {
    return (
      <GameUiHoverTip label={copy.show}>
        <button
          type="button"
          aria-label={copy.show}
          onClick={() => writeCourierEnabled(true)}
          className="fixed bottom-3 left-3 z-40 rounded-full border border-white/10 bg-black/70 p-1 opacity-60 hover:opacity-100"
        >
          <Image src={COURIER_TOKEN_SRC} alt="" width={18} height={18} className="h-[18px] w-[18px] object-contain" />
        </button>
      </GameUiHoverTip>
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
        <GameUiHoverTip label={item.source}>
          <Image src={item.token} alt={item.source} width={16} height={16} className="h-4 w-4 object-contain" />
        </GameUiHoverTip>
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
