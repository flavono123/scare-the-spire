"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import Image from "@/components/ui/static-image";
import { CardTile } from "@/components/codex/card-tile";
import { ColorfulPhilosopherReactionIcon } from "@/components/colorful-philosophers/reaction-icon";
import { DeferredCommentSection } from "@/components/patches/deferred-comment-section";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { GameUiHoverTip } from "@/components/game-ui-hover-tip";
import { SPIRE_ACTION_CONTROL_CLASS } from "@/components/spire-icon";
import { useAuth } from "@/hooks/use-auth";
import { readColorfulPhilosopherReaction } from "@/hooks/use-colorful-philosopher-posts";
import { saveResourceReaction } from "@/hooks/use-resource-reactions";
import {
  localizeHrefWithGameLocale,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import {
  COLORFUL_PHILOSOPHER_REACTIONS,
  COLORFUL_PHILOSOPHERS_HREF,
  COLORFUL_PHILOSOPHERS_TOKEN_SRC,
  addColorfulPhilosophersDays,
  colorfulPhilosophersWeekNumber,
  colorfulPhilosophersCommentThreadKey,
  type ColorfulPhilosopherPost,
  type ColorfulPhilosopherReaction,
} from "@/lib/colorful-philosophers";
import { serviceMessages } from "@/messages/service";
import { cn } from "@/lib/utils";

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

export function BackstabColorfulPhilosophersSection({
  entityMap,
  serviceLocale,
  gameLocale,
  cta,
  initialPosts,
}: {
  entityMap: Map<string, EntityInfo>;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  cta: string;
  initialPosts: ColorfulPhilosopherPost[];
}) {
  const copy = serviceMessages[serviceLocale].colorfulPhilosophers;
  const indexHref = localizeHrefWithGameLocale(COLORFUL_PHILOSOPHERS_HREF, serviceLocale, gameLocale);
  const { userId, ensureUser } = useAuth();
  const stackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [kinds, setKinds] = useState<Record<string, ColorfulPhilosopherReaction | null>>({});
  const [counts, setCounts] = useState<Record<string, { buff: number; nerf: number; rework: number }>>(() =>
    Object.fromEntries(initialPosts.map((post) => [post.id, {
      buff: post.buffCount,
      nerf: post.nerfCount,
      rework: post.reworkCount,
    }])),
  );
  const posts = initialPosts;

  useEffect(() => {
    if (stackRef.current) stackRef.current.setAttribute("data-react-managed", "true");
  }, []);

  useEffect(() => {
    setKinds(Object.fromEntries(posts.map((post) => [post.id, readColorfulPhilosopherReaction(post.id)])));
  }, [posts]);

  useEffect(() => {
    if (posts.length > 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- pick the opening card after paint
      setActiveIndex(Math.floor(Math.random() * posts.length));
    }
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
    const previous = kinds[post.id] ?? null;
    const nextKind = previous === next ? null : next;
    setKinds((current) => ({ ...current, [post.id]: nextKind }));
    setCounts((current) => {
      const row = { ...(current[post.id] ?? { buff: post.buffCount, nerf: post.nerfCount, rework: post.reworkCount }) };
      if (previous) row[previous] = Math.max(0, row[previous] - 1);
      if (nextKind) row[nextKind] += 1;
      return { ...current, [post.id]: row };
    });
    void (async () => {
      const activeUserId = userId ?? await ensureUser();
      if (!activeUserId) {
        setKinds((current) => ({ ...current, [post.id]: previous }));
        setCounts((current) => ({ ...current, [post.id]: { buff: post.buffCount, nerf: post.nerfCount, rework: post.reworkCount } }));
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
      if (!result.ok) {
        setKinds((current) => ({ ...current, [post.id]: previous }));
        setCounts((current) => ({ ...current, [post.id]: { buff: post.buffCount, nerf: post.nerfCount, rework: post.reworkCount } }));
      }
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
      <p className="mt-2 text-sm font-medium leading-relaxed text-muted-foreground">{copy.subtitle}</p>
      <div className="mt-6 flex justify-center">
        <div
          ref={stackRef}
          data-colorful-philosophers-preview-stack=""
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
            const row = counts[post.id] ?? { buff: post.buffCount, nerf: post.nerfCount, rework: post.reworkCount };
            return (
              <div
                key={post.id}
                data-colorful-philosophers-card=""
                className={cn(
                  "w-full transition-opacity duration-300",
                  active ? "relative opacity-100 pointer-events-auto" : "absolute inset-0 opacity-0 pointer-events-none",
                )}
              >
                <div className="rounded-xl border border-white/10 bg-black/35 px-4 py-4">
                  <div className="flex items-center gap-4">
                    {(post.slot === "card" || post.resourceType === "card") && entity?.cardData ? (
                      <div className="w-24 shrink-0">
                        <CardTile card={entity.cardData} serviceLocale={serviceLocale} width={96} />
                      </div>
                    ) : (
                      <Image src={post.imageUrl ?? COLORFUL_PHILOSOPHERS_TOKEN_SRC} alt="" width={72} height={72} className="object-contain" />
                    )}
                    <span className="min-w-0">
                      <span className="block font-service text-sm text-zinc-200">
                        {copy.weekNumber.replace("{week}", String(colorfulPhilosophersWeekNumber(post.weekStart)))}
                      </span>
                      <span className="block text-xs text-zinc-500">{`${post.weekStart.slice(5)} – ${weekEnd.slice(5)}`}</span>
                      <span className="block truncate font-service text-lg font-semibold text-primary">{post.nameKo}</span>
                      <span className="mt-1 line-clamp-3 block text-sm text-zinc-300">{post.body}</span>
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
                              kind === "buff" && (pressed ? "border-[#34d399] bg-[#34d399]/15" : "border-white/10 hover:border-[#34d399]/70"),
                              kind === "nerf" && (pressed ? "border-[#f87171] bg-[#f87171]/15" : "border-white/10 hover:border-[#f87171]/70"),
                              kind === "rework" && (pressed ? "border-[#f472b6] bg-[#f472b6]/15" : "border-white/10 hover:border-[#f472b6]/70"),
                            )}
                          >
                            <ColorfulPhilosopherReactionIcon kind={kind} active={pressed} lift size={18} />
                            <ReactionWords kind={kind} label={copy.reactions[kind]} />
                            <span
                              data-cp-count=""
                              className={cn(
                                "tabular-nums",
                                pressed ? (kind === "buff" ? "text-[#34d399]" : kind === "nerf" ? "text-[#f87171]" : "text-[#f472b6]") : "text-zinc-400",
                              )}
                            >
                              {row[kind]}
                            </span>
                          </button>
                        </GameUiHoverTip>
                      );
                    })}
                  </div>
                  <div className="mt-4">
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
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
  var stack=document.querySelector("[data-colorful-philosophers-preview-stack]");
  if(!stack)return;
  var cards=stack.querySelectorAll("[data-colorful-philosophers-card]");
  if(cards.length<2)return;
  if(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  if(stack.getAttribute("data-react-managed")==="true")return;
  var current=Math.floor(Math.random()*cards.length);
  var paused=false;
  function show(next){
    cards[current].classList.remove("opacity-100","pointer-events-auto","relative");
    cards[current].classList.add("opacity-0","pointer-events-none","absolute","inset-0");
    cards[next].classList.remove("opacity-0","pointer-events-none","absolute","inset-0");
    cards[next].classList.add("opacity-100","pointer-events-auto","relative");
    current=next;
    document.dispatchEvent(new Event("cp-reel-show"));
  }
  if(current!==0)show(current);
  stack.addEventListener("mouseover",function(event){
    var target=event.target&&event.target.closest&&event.target.closest("[data-cp-reaction],[data-patch-comment-root],textarea,input,button");
    if(target)paused=true;
  });
  stack.addEventListener("mouseenter",function(){paused=true;});
  stack.addEventListener("mouseleave",function(event){
    var next=event.relatedTarget;
    if(next&&next.closest&&next.closest("[data-cp-reaction],[data-hover-tip-layer]"))return;
    if(!stack.contains(document.activeElement))paused=false;
  });
  stack.addEventListener("focusin",function(){paused=true;});
  stack.addEventListener("focusout",function(){setTimeout(function(){if(!stack.contains(document.activeElement))paused=false;},0);});
  var timer=setInterval(function(){
    if(stack.getAttribute("data-react-managed")==="true"){clearInterval(timer);return;}
    if(document.hidden||paused)return;
    var next=Math.floor(Math.random()*cards.length);
    while(next===current&&cards.length>1)next=Math.floor(Math.random()*cards.length);
    show(next);
  },3200);
})();`,
          }}
        />
      </div>
    </div>
  );
}
