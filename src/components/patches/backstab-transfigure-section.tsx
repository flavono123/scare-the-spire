"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "@/components/ui/static-image";
import { RichText } from "@/components/rich-text";
import { TransfigurePostCard } from "@/components/transfigure/transfigure-post-card";
import type { EntityInfo } from "@/components/patch-note-renderer";
import {
  localizeHrefWithGameLocale,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import {
  normalizeTransfigurePost,
  type TransfigurePost,
} from "@/lib/transfigure-types";
import { BUILTIN_SAMPLE_TRANSFIGURES } from "@/lib/transfigure-builtins";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export function BackstabTransfigureSection({
  entities,
  entityMap,
  serviceLocale,
  gameLocale,
  transfigureTitle,
  transfigureLead,
  transfigureCta,
  initialPosts,
}: {
  entities: EntityInfo[];
  entityMap: Map<string, EntityInfo>;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  transfigureTitle: string;
  transfigureLead: string;
  transfigureCta: string;
  initialPosts?: TransfigurePost[];
}) {
  const upgradeLabel = serviceLocale === "ko" ? "강화" : "Upgrade";
  const transfigureRootHref = localizeHrefWithGameLocale(
    "/transfigure",
    serviceLocale,
    gameLocale,
  );

  const stackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const [posts, setPosts] = useState<readonly TransfigurePost[]>(() => {
    return initialPosts && initialPosts.length > 0
      ? initialPosts
      : BUILTIN_SAMPLE_TRANSFIGURES;
  });

  // Client-side: request real transfigures once upon entering page
  useEffect(() => {
    if (!supabaseEnabled) return;
    let cancelled = false;
    supabase
      .from("transfigure_posts")
      .select("*")
      .eq("env", supabaseEnv)
      .order("created_at", { ascending: false })
      .limit(15)
      .then(
        ({ data, error }) => {
          if (error || !data || cancelled || data.length === 0) return;
          const normalized = data.map(normalizeTransfigurePost).filter(Boolean);
          if (normalized.length > 0) {
            setPosts(normalized);
          }
        },
        () => {},
      );

    return () => {
      cancelled = true;
    };
  }, []);

  const displayPosts = useMemo(() => {
    const valid = posts.filter((p) =>
      entityMap.has(`${p.resource_type}:${p.resource_id}`),
    );
    return valid.length > 0 ? valid : BUILTIN_SAMPLE_TRANSFIGURES;
  }, [posts, entityMap]);

  // Mark stack as React-managed on client mount
  useEffect(() => {
    if (stackRef.current) {
      stackRef.current.setAttribute("data-react-managed", "true");
    }
  }, []);

  // Randomize active card on mount and whenever posts update
  useEffect(() => {
    if (displayPosts.length > 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- randomize initial active card on client mount
      setActiveIndex(Math.floor(Math.random() * displayPosts.length));
    }
  }, [displayPosts]);

  // Periodic cycling between real transfigures with hover pause
  useEffect(() => {
    if (displayPosts.length <= 1 || isHovered) return;

    const timer = setInterval(() => {
      if (document.hidden) return;
      setActiveIndex((current) => {
        let next = Math.floor(Math.random() * displayPosts.length);
        while (next === current && displayPosts.length > 1) {
          next = Math.floor(Math.random() * displayPosts.length);
        }
        return next;
      });
    }, 3200);

    return () => clearInterval(timer);
  }, [displayPosts.length, isHovered]);

  return (
    <div className="mt-10">
      {/* Header: Token + Title and CTA Chip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Image
            src="/images/sts2/relics/astrolabe.webp"
            alt={transfigureTitle}
            width={24}
            height={24}
            className="h-6 w-6 shrink-0 object-contain"
          />
          <h2 className="font-game-title text-xl font-bold tracking-wide text-foreground">
            {transfigureTitle}
          </h2>
        </div>

        <Link
          href={transfigureRootHref}
          className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-amber-400/40 bg-amber-500/15 px-3.5 py-1.5 text-xs font-semibold text-amber-200 transition-colors hover:border-amber-300/60 hover:bg-amber-500/25 hover:text-amber-100"
        >
          <span>{transfigureCta}</span>
          <span aria-hidden="true">&rarr;</span>
        </Link>
      </div>

      {/* Hero Tinker Time lead quote: styled with gray/muted tone */}
      <div className="mt-2 text-sm font-medium leading-relaxed text-muted-foreground">
        <RichText text={transfigureLead} />
      </div>

      {/* Transfigure Index Card Asset Preview Stack with Random Crossfade Animation */}
      <div className="mt-6 flex justify-center">
        <div
          ref={stackRef}
          data-transfigure-preview-stack=""
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="relative w-full max-w-sm sm:max-w-md"
        >
          {displayPosts.map((post, index) => {
            const postHref = localizeHrefWithGameLocale(
              `/transfigure/${post.id}`,
              serviceLocale,
              gameLocale,
            );
            const isActive = index === activeIndex;

            return (
              <div
                key={post.id}
                data-transfigure-card=""
                data-href={postHref}
                className={cn(
                  "w-full transition-opacity duration-300",
                  isActive
                    ? "relative opacity-100 pointer-events-auto"
                    : "absolute inset-0 opacity-0 pointer-events-none",
                )}
              >
                <TransfigurePostCard
                  post={post}
                  entities={entities}
                  entityMap={entityMap}
                  serviceLocale={serviceLocale}
                  gameLocale={gameLocale}
                  upgradeLabel={upgradeLabel}
                  userId={null}
                  commentCount={post.comment_count ?? 0}
                  likeCount={post.like_count ?? 0}
                  readOnlyEngagement
                />
              </div>
            );
          })}
        </div>

        {/* Self-contained client animation script: works in static patch worker without React */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  var stack = document.querySelector("[data-transfigure-preview-stack]");
  if (!stack) return;
  var cards = stack.querySelectorAll("[data-transfigure-card]");
  if (cards.length < 2) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (stack.getAttribute("data-react-managed") === "true") return;

  var current = Math.floor(Math.random() * cards.length);
  if (current !== 0) {
    cards[0].classList.remove("opacity-100", "pointer-events-auto", "relative");
    cards[0].classList.add("opacity-0", "pointer-events-none", "absolute", "inset-0");
    cards[current].classList.remove("opacity-0", "pointer-events-none", "absolute", "inset-0");
    cards[current].classList.add("opacity-100", "pointer-events-auto", "relative");
  }

  var isHovered = false;
  stack.addEventListener("mouseenter", function() { isHovered = true; });
  stack.addEventListener("mouseleave", function() { isHovered = false; });

  // Static click delegation for patch worker
  stack.addEventListener("click", function(e) {
    if (e.target.closest("a, button, [role='button']")) return;
    var card = e.target.closest("[data-transfigure-card]");
    if (!card) return;
    var href = card.getAttribute("data-href");
    if (href) window.location.href = href;
  });

  var timer = setInterval(function() {
    if (stack.getAttribute("data-react-managed") === "true") {
      clearInterval(timer);
      return;
    }
    if (document.hidden || isHovered) return;
    var next = Math.floor(Math.random() * cards.length);
    while (next === current && cards.length > 1) {
      next = Math.floor(Math.random() * cards.length);
    }
    cards[current].classList.remove("opacity-100", "pointer-events-auto", "relative");
    cards[current].classList.add("opacity-0", "pointer-events-none", "absolute", "inset-0");
    cards[next].classList.remove("opacity-0", "pointer-events-none", "absolute", "inset-0");
    cards[next].classList.add("opacity-100", "pointer-events-auto", "relative");
    current = next;
  }, 3200);
})();
`,
          }}
        />
      </div>
    </div>
  );
}
