"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "@/components/ui/static-image";
import { CardTile } from "@/components/codex/card-tile";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { SpireIcon } from "@/components/spire-icon";
import {
  localizeHrefWithGameLocale,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import {
  COLORFUL_PHILOSOPHER_REACTIONS,
  COLORFUL_PHILOSOPHER_REACTION_TOKENS,
  COLORFUL_PHILOSOPHERS_HREF,
  COLORFUL_PHILOSOPHERS_TOKEN_SRC,
  addColorfulPhilosophersDays,
  type ColorfulPhilosopherPost,
} from "@/lib/colorful-philosophers";
import { serviceMessages } from "@/messages/service";
import { cn } from "@/lib/utils";

export function BackstabColorfulPhilosophersSection({
  entityMap,
  serviceLocale,
  gameLocale,
  initialPosts,
}: {
  entityMap: Map<string, EntityInfo>;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  initialPosts: ColorfulPhilosopherPost[];
}) {
  const copy = serviceMessages[serviceLocale].colorfulPhilosophers;
  const indexHref = localizeHrefWithGameLocale(COLORFUL_PHILOSOPHERS_HREF, serviceLocale, gameLocale);
  const stackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const posts = initialPosts;

  useEffect(() => {
    if (stackRef.current) stackRef.current.setAttribute("data-react-managed", "true");
  }, []);

  useEffect(() => {
    if (posts.length > 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- randomize the first card after paint
      setActiveIndex(Math.floor(Math.random() * posts.length));
    }
  }, [posts]);

  useEffect(() => {
    if (posts.length <= 1 || isHovered) return;
    const timer = setInterval(() => {
      if (document.hidden) return;
      setActiveIndex((current) => {
        let next = Math.floor(Math.random() * posts.length);
        while (next === current && posts.length > 1) next = Math.floor(Math.random() * posts.length);
        return next;
      });
    }, 3200);
    return () => clearInterval(timer);
  }, [posts.length, isHovered]);

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
          className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-amber-400/40 bg-amber-500/15 px-3.5 py-1.5 text-xs font-semibold text-amber-200 transition-colors hover:border-amber-300/60 hover:bg-amber-500/25 hover:text-amber-100"
        >
          <span>{copy.galleryCta}</span>
          <span aria-hidden="true">&rarr;</span>
        </Link>
      </div>
      <p className="mt-2 text-sm font-medium leading-relaxed text-muted-foreground">{copy.subtitle}</p>
      <div className="mt-6 flex justify-center">
        <div
          ref={stackRef}
          data-colorful-philosophers-preview-stack=""
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="relative w-full max-w-sm sm:max-w-md"
        >
          {posts.map((post, index) => {
            const href = localizeHrefWithGameLocale(`${COLORFUL_PHILOSOPHERS_HREF}/${post.id}`, serviceLocale, gameLocale);
            const active = index === activeIndex;
            const entity = entityMap.get(`${post.slot}:${post.resourceId}`);
            const weekEnd = addColorfulPhilosophersDays(post.weekStart, 6);
            return (
              <div
                key={post.id}
                data-colorful-philosophers-card=""
                data-href={href}
                className={cn(
                  "w-full cursor-pointer transition-opacity duration-300",
                  active ? "relative opacity-100 pointer-events-auto" : "absolute inset-0 opacity-0 pointer-events-none",
                )}
              >
                <Link href={href} className="block rounded-xl border border-white/10 bg-black/35 px-4 py-4">
                  <div className="flex items-center gap-4">
                    {post.slot === "card" && entity?.cardData ? (
                      <div className="w-24 shrink-0">
                        <CardTile card={entity.cardData} serviceLocale={serviceLocale} width={96} />
                      </div>
                    ) : (
                      <Image src={post.imageUrl ?? COLORFUL_PHILOSOPHERS_TOKEN_SRC} alt="" width={72} height={72} className="object-contain" />
                    )}
                    <span className="min-w-0">
                      <span className="block font-service text-xs text-zinc-500">{`${post.weekStart.slice(5)} – ${weekEnd.slice(5)}`}</span>
                      <span className="block truncate font-service text-lg font-semibold text-primary">{post.nameKo}</span>
                      <span className="mt-1 line-clamp-3 block text-sm text-zinc-300">{post.body}</span>
                    </span>
                  </div>
                  <span className="mt-3 flex gap-3 text-xs text-muted-foreground">
                    {COLORFUL_PHILOSOPHER_REACTIONS.map((kind) => (
                      <span key={kind} className="inline-flex items-center gap-1">
                        <SpireIcon src={COLORFUL_PHILOSOPHER_REACTION_TOKENS[kind].src} size={14} variant={COLORFUL_PHILOSOPHER_REACTION_TOKENS[kind].variant} />
                        <span className="tabular-nums">{post[`${kind}Count`]}</span>
                      </span>
                    ))}
                  </span>
                </Link>
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
  function show(next){
    cards[current].classList.remove("opacity-100","pointer-events-auto","relative");
    cards[current].classList.add("opacity-0","pointer-events-none","absolute","inset-0");
    cards[next].classList.remove("opacity-0","pointer-events-none","absolute","inset-0");
    cards[next].classList.add("opacity-100","pointer-events-auto","relative");
    current=next;
  }
  if(current!==0)show(current);
  var hovered=false;
  stack.addEventListener("mouseenter",function(){hovered=true;});
  stack.addEventListener("mouseleave",function(){hovered=false;});
  stack.addEventListener("click",function(event){
    if(event.target.closest("a,button"))return;
    var card=event.target.closest("[data-colorful-philosophers-card]");
    var href=card&&card.getAttribute("data-href");
    if(href)window.location.href=href;
  });
  var timer=setInterval(function(){
    if(stack.getAttribute("data-react-managed")==="true"){clearInterval(timer);return;}
    if(document.hidden||hovered)return;
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
