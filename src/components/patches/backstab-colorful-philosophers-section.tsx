"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import Image from "@/components/ui/static-image";
import { ColorfulPhilosopherReactionIcon } from "@/components/colorful-philosophers/reaction-icon";
import { ColorfulPhilosopherSubjectArt } from "@/components/colorful-philosophers/subject-art";
import { DeferredCommentSection } from "@/components/patches/deferred-comment-section";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { GameUiHoverTip } from "@/components/game-ui-hover-tip";
import { RichText } from "@/components/rich-text";
import { SPIRE_ACTION_CONTROL_CLASS } from "@/components/spire-icon";
import { useAuth } from "@/hooks/use-auth";
import {
  fetchResourceReactionCounts,
  readResourceReaction,
  resourceReactionKey,
  saveResourceReaction,
  type ResourceReactionCounts,
} from "@/hooks/use-resource-reactions";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import {
  localizeHrefWithGameLocale,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import {
  COLORFUL_PHILOSOPHER_REACTIONS,
  COLORFUL_PHILOSOPHERS_EPOCH,
  COLORFUL_PHILOSOPHERS_HREF,
  COLORFUL_PHILOSOPHERS_TOKEN_SRC,
  addColorfulPhilosophersDays,
  colorfulPhilosopherPostFromRow,
  colorfulPhilosophersReelPosts,
  colorfulPhilosophersWeekStart,
  colorfulPhilosophersWeekNumber,
  colorfulPhilosophersCommentThreadKey,
  type ColorfulPhilosopherPost,
  type ColorfulPhilosopherReaction,
} from "@/lib/colorful-philosophers";
import { serviceMessages } from "@/messages/service";
import { cn } from "@/lib/utils";

const REACTION_BUTTON_CLASS: Record<ColorfulPhilosopherReaction, string> = {
  buff: "border-white/10 hover:border-[#34d399]/70 aria-pressed:border-[#34d399] aria-pressed:bg-[#34d399]/15",
  nerf: "border-white/10 hover:border-[#f87171]/70 aria-pressed:border-[#f87171] aria-pressed:bg-[#f87171]/15",
  rework: "border-white/10 hover:border-[#f472b6]/70 aria-pressed:border-[#f472b6] aria-pressed:bg-[#f472b6]/15",
};

const REACTION_COUNT_CLASS: Record<ColorfulPhilosopherReaction, string> = {
  buff: "group-aria-pressed/spire:text-[#34d399]",
  nerf: "group-aria-pressed/spire:text-[#f87171]",
  rework: "group-aria-pressed/spire:text-[#f472b6]",
};

/**
 * Static patch pages never hydrate, so rotation lives in this inline script.
 * It re-reads the card list on every tick because patch-comments.js swaps in
 * the live week after load and announces it with `cp-reel-refresh`.
 */
const REEL_ROTATION_SCRIPT = `(function(){
  var stack=document.querySelector("[data-colorful-philosophers-preview-stack]");
  if(!stack)return;
  var ON=["opacity-100","pointer-events-auto","relative"],OFF=["opacity-0","pointer-events-none","absolute","inset-0"];
  function managed(){return !stack.isConnected||stack.getAttribute("data-react-managed")==="true";}
  function cards(){return Array.prototype.slice.call(stack.querySelectorAll("[data-colorful-philosophers-card]"));}
  function active(){return stack.querySelector("[data-colorful-philosophers-card].pointer-events-auto");}
  function show(card){
    cards().forEach(function(c){var on=c===card;ON.forEach(function(k){c.classList.toggle(k,on);});OFF.forEach(function(k){c.classList.toggle(k,!on);});});
    document.dispatchEvent(new Event("cp-reel-show"));
  }
  function pick(){
    var list=cards();if(!list.length)return;
    var current=active();
    var pool=list.filter(function(c){return c!==current;});
    show(pool.length?pool[Math.floor(Math.random()*pool.length)]:list[0]);
  }
  var still=!!(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var paused=false;
  if(!still&&cards().length>1)pick();
  document.addEventListener("cp-reel-refresh",function(){if(!managed()&&!active())pick();});
  stack.addEventListener("mouseover",function(event){
    var target=event.target&&event.target.closest&&event.target.closest("[data-cp-reaction],[data-patch-comment-root],textarea,input,button,a");
    if(target)paused=true;
  });
  stack.addEventListener("mouseenter",function(){paused=true;});
  stack.addEventListener("mouseleave",function(event){
    var next=event.relatedTarget;
    if(next&&next.closest&&next.closest("[data-cp-reaction],[data-hover-tip-layer],[data-static-card-preview]"))return;
    if(!stack.contains(document.activeElement))paused=false;
  });
  stack.addEventListener("focusin",function(){paused=true;});
  stack.addEventListener("focusout",function(){setTimeout(function(){if(!stack.contains(document.activeElement))paused=false;},0);});
  var timer=setInterval(function(){
    if(managed()){clearInterval(timer);return;}
    if(still||document.hidden||paused||cards().length<2)return;
    pick();
  },3200);
})();`;

function ReactionWords({ kind, label }: { kind: ColorfulPhilosopherReaction; label: string }) {
  if (kind === "buff") {
    return (
      <span className="rich-sine font-semibold text-[#34d399]">
        {Array.from(label).map((letter, index) => (
          <span key={`${letter}-${index}`} className="rich-sine-letter" style={{ "--rich-sine-index": index } as CSSProperties}>
            {letter}
          </span>
        ))}
      </span>
    );
  }
  if (kind === "nerf") return <span className="rich-jitter font-semibold text-[#f87171]">{label}</span>;
  return <span className="font-semibold text-[#f472b6]">{label}</span>;
}

function postCounts(post: ColorfulPhilosopherPost): ResourceReactionCounts {
  return { buff: post.buffCount, nerf: post.nerfCount, rework: post.reworkCount };
}

export function BackstabColorfulPhilosophersSection({
  entityMap,
  serviceLocale,
  gameLocale,
  cta,
  hero,
  initialPosts,
  staticHoverPreviews = false,
}: {
  entityMap: Map<string, EntityInfo>;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  cta: string;
  hero: string;
  initialPosts: ColorfulPhilosopherPost[];
  staticHoverPreviews?: boolean;
}) {
  const copy = serviceMessages[serviceLocale].colorfulPhilosophers;
  const indexHref = localizeHrefWithGameLocale(COLORFUL_PHILOSOPHERS_HREF, serviceLocale, gameLocale);
  const { userId, ensureUser } = useAuth();
  const stackRef = useRef<HTMLDivElement>(null);
  const [hydrated, setHydrated] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [posts, setPosts] = useState(() => colorfulPhilosophersReelPosts(initialPosts));
  const [kinds, setKinds] = useState<Record<string, ColorfulPhilosopherReaction | null>>({});
  const [counts, setCounts] = useState<Record<string, ResourceReactionCounts>>(() =>
    Object.fromEntries(initialPosts.map((post) => [resourceReactionKey(post), postCounts(post)])),
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- remount the reel so the pre-hydration rotation script's class edits are discarded
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!supabaseEnabled) return;
    let cancelled = false;
    const currentWeek = colorfulPhilosophersWeekStart();
    supabase.from("colorful_philosopher_posts")
      .select("id, week_start, slot, resource_type, resource_id, name_ko, name_en, image_url, body, game_version, buff_count, nerf_count, rework_count")
      .eq("env", supabaseEnv)
      .lte("week_start", currentWeek)
      .order("week_start", { ascending: false })
      .limit(12)
      .then(async ({ data }) => {
        if (cancelled || !data?.length) return;
        const next = colorfulPhilosophersReelPosts(
          data.flatMap((row) => {
            const post = colorfulPhilosopherPostFromRow(row);
            return post ? [post] : [];
          }),
          currentWeek,
        );
        if (next.length === 0) return;
        setPosts(next);
        const live = await fetchResourceReactionCounts(next);
        if (cancelled || !live) return;
        setCounts((current) => ({ ...current, ...Object.fromEntries(live) }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read this browser's reactions after paint
    setKinds(Object.fromEntries(posts.map((post) => [post.id, readResourceReaction(post)])));
  }, [posts]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pick the opening card after paint
    setActiveIndex(posts.length > 1 ? Math.floor(Math.random() * posts.length) : 0);
  }, [posts]);

  useEffect(() => {
    if (posts.length <= 1 || paused) return;
    const timer = setInterval(() => {
      if (document.hidden) return;
      setActiveIndex((current) => {
        let next = Math.floor(Math.random() * posts.length);
        while (next === current && posts.length > 1) next = Math.floor(Math.random() * posts.length);
        return next;
      });
    }, 3200);
    return () => clearInterval(timer);
  }, [paused, posts.length]);

  const releasePause = () => {
    const stack = stackRef.current;
    if (stack?.contains(document.activeElement) || stack?.matches(":hover")) return;
    setPaused(false);
  };

  const choose = (post: ColorfulPhilosopherPost, next: ColorfulPhilosopherReaction) => {
    const key = resourceReactionKey(post);
    const previous = kinds[post.id] ?? null;
    const previousRow = counts[key] ?? postCounts(post);
    const nextKind = previous === next ? null : next;
    const revert = () => {
      setKinds((current) => ({ ...current, [post.id]: previous }));
      setCounts((current) => ({ ...current, [key]: previousRow }));
    };
    setKinds((current) => ({ ...current, [post.id]: nextKind }));
    setCounts((current) => {
      const row = { ...(current[key] ?? previousRow) };
      if (previous) row[previous] = Math.max(0, row[previous] - 1);
      if (nextKind) row[nextKind] += 1;
      return { ...current, [key]: row };
    });
    void (async () => {
      const activeUserId = userId ?? await ensureUser();
      if (!activeUserId) {
        revert();
        return;
      }
      const result = await saveResourceReaction({
        resourceType: post.resourceType,
        resourceId: post.resourceId,
        gameVersion: post.gameVersion,
        userId: activeUserId,
        previous,
        next,
      });
      if (!result.ok) revert();
    })();
  };

  if (posts.length === 0) return null;

  return (
    <div className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Image src={COLORFUL_PHILOSOPHERS_TOKEN_SRC} alt="" width={24} height={24} className="h-6 w-6 shrink-0 object-contain" />
          <h2 className="font-game-title text-xl font-bold tracking-wide text-foreground">{copy.title}</h2>
        </div>
        <Link
          href={indexHref}
          className="inline-flex max-w-full shrink items-center gap-1.5 self-start rounded-lg border border-amber-400/40 bg-amber-500/15 px-3.5 py-1.5 text-xs font-semibold text-amber-200 transition-colors hover:border-amber-300/60 hover:bg-amber-500/25 hover:text-amber-100"
        >
          <span>{cta}</span>
          <span aria-hidden="true">&rarr;</span>
        </Link>
      </div>
      <div className="mt-2 text-sm font-medium leading-relaxed text-muted-foreground">
        <RichText text={hero} />
      </div>
      <div className="mt-6 flex justify-center">
        <div
          key={hydrated ? "live" : "static"}
          ref={stackRef}
          data-colorful-philosophers-preview-stack=""
          data-react-managed={hydrated ? "true" : undefined}
          data-cp-epoch={COLORFUL_PHILOSOPHERS_EPOCH}
          data-cp-week-template={copy.weekNumber}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={releasePause}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => {
            window.setTimeout(releasePause, 0);
          }}
          className="relative w-full max-w-sm sm:max-w-md"
        >
          {posts.map((post, index) => {
            const active = index === activeIndex;
            const entity = entityMap.get(`${post.resourceType}:${post.resourceId}`);
            const weekEnd = addColorfulPhilosophersDays(post.weekStart, 6);
            const row = counts[resourceReactionKey(post)] ?? postCounts(post);
            return (
              <div
                key={post.id}
                data-colorful-philosophers-card=""
                data-cp-id={post.id}
                data-cp-week-start={post.weekStart}
                className={cn(
                  "w-full transition-opacity duration-300",
                  active ? "relative opacity-100 pointer-events-auto" : "absolute inset-0 opacity-0 pointer-events-none",
                )}
              >
                <div className="rounded-xl border border-white/10 bg-black/35 px-4 py-4">
                  <div className="flex items-center gap-4">
                    <span data-cp-art="" className="flex shrink-0">
                      <ColorfulPhilosopherSubjectArt
                        post={post}
                        serviceLocale={serviceLocale}
                        width={96}
                        imageWidth={72}
                        entity={entity}
                        staticHoverPreviews={staticHoverPreviews}
                      />
                    </span>
                    <span className="min-w-0">
                      <span data-cp-week="" className="block font-service text-sm text-zinc-200">
                        {copy.weekNumber.replace("{week}", String(colorfulPhilosophersWeekNumber(post.weekStart)))}
                      </span>
                      <span data-cp-dates="" className="block text-xs text-zinc-500">{`${post.weekStart.slice(5)} – ${weekEnd.slice(5)}`}</span>
                      <span data-cp-name="" className="block truncate font-service text-lg font-semibold text-primary">{post.nameKo}</span>
                      <span data-cp-body="" className="mt-1 line-clamp-3 block text-sm text-zinc-300">{post.body}</span>
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {COLORFUL_PHILOSOPHER_REACTIONS.map((kind) => {
                      const pressed = kinds[post.id] === kind;
                      const tip = pressed ? copy.reactionClear[kind] : copy.reactions[kind];
                      return (
                        <GameUiHoverTip key={kind} label={tip}>
                          <button
                            type="button"
                            data-cp-reaction=""
                            data-cp-post={post.id}
                            data-cp-type={post.resourceType}
                            data-cp-resource={post.resourceId}
                            data-cp-version={post.gameVersion}
                            data-cp-kind={kind}
                            aria-pressed={pressed}
                            aria-label={tip}
                            onMouseEnter={() => setPaused(true)}
                            onClick={() => choose(post, kind)}
                            className={cn(
                              SPIRE_ACTION_CONTROL_CLASS,
                              "gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                              REACTION_BUTTON_CLASS[kind],
                            )}
                          >
                            <ColorfulPhilosopherReactionIcon kind={kind} pressedFromAria lift size={18} />
                            <ReactionWords kind={kind} label={copy.reactions[kind]} />
                            <span data-cp-count="" className={cn("tabular-nums text-zinc-400", REACTION_COUNT_CLASS[kind])}>
                              {row[kind]}
                            </span>
                          </button>
                        </GameUiHoverTip>
                      );
                    })}
                  </div>
                  <div data-cp-comments="" className="mt-4">
                    <DeferredCommentSection
                      threadKey={colorfulPhilosophersCommentThreadKey(post.id)}
                      density="inline"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <script dangerouslySetInnerHTML={{ __html: REEL_ROTATION_SCRIPT }} />
      </div>
    </div>
  );
}
