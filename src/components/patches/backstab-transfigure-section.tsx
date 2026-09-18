"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "@/components/ui/static-image";
import { GameUiHoverTip } from "@/components/game-ui-hover-tip";
import { RichText } from "@/components/rich-text";
import { ThisOrThatResourcePanel } from "@/components/this-or-that/resource-panel";
import { TransfigureResourcePreview } from "@/components/transfigure/transfigure-resource-preview";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { useTransfigurePosts } from "@/hooks/use-transfigure-posts";
import {
  localizeHrefWithGameLocale,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import type { TransfigurePost } from "@/lib/transfigure-types";
import { cn } from "@/lib/utils";

const PREVIEW_INTERVAL_MS = 2800;
const PREVIEW_FADE_MS = 220;

// Curated built-in sample transfigure posts (featured in Byrdispatch)
const BUILTIN_SAMPLE_TRANSFIGURES: readonly TransfigurePost[] = [
  {
    id: "ab3f946e-c6c8-4eb2-9092-e244b891b0fe",
    user_id: "system",
    nickname: "기가크릿",
    title: "허상 (메가크릿 정상화)",
    resource_type: "card",
    resource_id: "EIDOLON",
    source_text: "모든 적에게 [gold]약화[/gold]를 1 부여합니다. 턴 종료 시까지 [gold]무형[/gold]을 1 얻습니다.",
    source_game_locale: "kor",
    transformed_name: "허상",
    transformed_cost: "1",
    transformed_star_cost: null,
    transformed_card_type: "스킬",
    transformed_card_rarity: "희귀",
    transformed_card_color: "defect",
    omit_energy_cost: false,
    card_top_keywords: [],
    card_bottom_keywords: [],
    upgraded_content: null,
    upgraded_content_text: null,
    transformed_upgrade_cost: null,
    transformed_upgrade_star_cost: null,
    upgraded_card_top_keywords: [],
    upgraded_card_bottom_keywords: [],
    show_upgrade: false,
    token_color: null,
    token_wax: null,
    content: [
      {
        type: "text",
        text: "턴 종료 시까지 [gold]무형[/gold]을 1 얻습니다. [gold]소멸[/gold].",
      },
    ],
    content_text: "턴 종료 시까지 [gold]무형[/gold]을 1 얻습니다. [gold]소멸[/gold].",
    env: "production",
    created_at: "2026-07-26T00:00:00Z",
  },
  {
    id: "0b2e7754-39a4-48a3-ad0e-7abcd0030cbb",
    user_id: "system",
    nickname: "밸런스장인",
    title: "기리야 (휴식 강화)",
    resource_type: "relic",
    resource_id: "GIRYA",
    source_text: "[gold]휴식 장소[/gold]에서 최대 3번 [gold]힘[/gold]을 1 올릴 수 있습니다.",
    source_game_locale: "kor",
    transformed_name: "기리야",
    transformed_cost: null,
    transformed_star_cost: null,
    transformed_card_type: null,
    transformed_card_rarity: null,
    transformed_card_color: null,
    omit_energy_cost: false,
    card_top_keywords: [],
    card_bottom_keywords: [],
    upgraded_content: null,
    upgraded_content_text: null,
    transformed_upgrade_cost: null,
    transformed_upgrade_star_cost: null,
    upgraded_card_top_keywords: [],
    upgraded_card_bottom_keywords: [],
    show_upgrade: false,
    token_color: null,
    token_wax: null,
    content: [
      {
        type: "text",
        text: "획득 시 및 [gold]휴식 장소[/gold]에서 최대 3번 [gold]힘[/gold]을 1 올릴 수 있습니다.",
      },
    ],
    content_text: "획득 시 및 [gold]휴식 장소[/gold]에서 최대 3번 [gold]힘[/gold]을 1 올릴 수 있습니다.",
    env: "production",
    created_at: "2026-07-26T00:00:00Z",
  },
  {
    id: "sample-cold-mittens",
    user_id: "system",
    nickname: "첨탑대장장이",
    title: "따뜻한 벙어리장갑 (냉기 버전)",
    resource_type: "relic",
    resource_id: "TOASTY_MITTENS",
    source_text: "전투 시작 시, [gold]화염 장벽[/gold]을 1장 손으로 가져옵니다.",
    source_game_locale: "kor",
    transformed_name: "시린 벙어리장갑",
    transformed_cost: null,
    transformed_star_cost: null,
    transformed_card_type: null,
    transformed_card_rarity: null,
    transformed_card_color: null,
    omit_energy_cost: false,
    card_top_keywords: [],
    card_bottom_keywords: [],
    upgraded_content: null,
    upgraded_content_text: null,
    transformed_upgrade_cost: null,
    transformed_upgrade_star_cost: null,
    upgraded_card_top_keywords: [],
    upgraded_card_bottom_keywords: [],
    show_upgrade: false,
    token_color: null,
    token_wax: null,
    content: [
      {
        type: "text",
        text: "전투 시작 시, [gold]빙하[/gold]를 1장 손으로 가져옵니다.",
      },
    ],
    content_text: "전투 시작 시, [gold]빙하[/gold]를 1장 손으로 가져옵니다.",
    env: "production",
    created_at: "2026-08-20T00:00:00Z",
  },
];

export function BackstabTransfigureSection({
  entities,
  entityMap,
  serviceLocale,
  gameLocale,
  transfigureLead,
  transfigureTryNew,
  transfigureCta,
}: {
  entities: EntityInfo[];
  entityMap: Map<string, EntityInfo>;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  transfigureLead: string;
  transfigureTryNew: string;
  transfigureCta: string;
}) {
  const router = useRouter();
  const { posts: livePosts } = useTransfigurePosts(null, "recommended");

  const posts = useMemo(() => {
    if (livePosts.length > 0) return livePosts;
    return BUILTIN_SAMPLE_TRANSFIGURES;
  }, [livePosts]);

  const [postIndex, setPostIndex] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (posts.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let fadeTimer = 0;
    const interval = window.setInterval(() => {
      if (document.hidden) return;
      setFading(true);
      fadeTimer = window.setTimeout(() => {
        setPostIndex((current) => (current + 1) % posts.length);
        setFading(false);
      }, PREVIEW_FADE_MS);
    }, PREVIEW_INTERVAL_MS);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(fadeTimer);
    };
  }, [posts.length]);

  const currentPost = posts.length > 0 ? posts[postIndex % posts.length] : null;
  const currentEntity = currentPost
    ? entityMap.get(`${currentPost.resource_type}:${currentPost.resource_id}`)
    : undefined;

  const hoverTipText = serviceLocale === "ko" ? "변형으로 이동하기" : "Go to Transfigure";
  const transfigureIndexHref = localizeHrefWithGameLocale(
    "/transfigure",
    serviceLocale,
    gameLocale,
  );
  const currentPostHref = currentPost
    ? localizeHrefWithGameLocale(
        `/transfigure/${currentPost.id}`,
        serviceLocale,
        gameLocale,
      )
    : transfigureIndexHref;

  const handleMatchupClick = () => {
    router.push(currentPostHref);
  };

  return (
    <section
      data-backstab-transfigure-section=""
      className="mt-8 rounded-xl border border-amber-500/25 bg-amber-950/10 p-5 shadow-[0_0_32px_rgba(245,158,11,0.06)]"
    >
      {/* Header with gamelocale borrowed quotes */}
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Image
              src="/images/sts2/relics/astrolabe.webp"
              alt="변형"
              width={22}
              height={22}
              className="h-5.5 w-5.5 shrink-0 object-contain"
            />
            <span className="font-game-title text-base font-bold text-amber-200">
              {transfigureTryNew}
            </span>
          </div>
          <p className="mt-1 font-service text-sm font-medium leading-relaxed text-amber-100/80">
            <RichText text={transfigureLead} />
          </p>
        </div>

        <Link
          href={transfigureIndexHref}
          className="mt-2 inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-amber-400/40 bg-amber-500/15 px-3.5 py-1.5 text-xs font-semibold text-amber-200 transition-colors hover:border-amber-300/60 hover:bg-amber-500/25 hover:text-amber-100 sm:mt-0"
        >
          <span>{transfigureCta}</span>
          <span aria-hidden>&rarr;</span>
        </Link>
      </div>

      {/* VS Matchup preview with animation */}
      {currentPost && currentEntity ? (
        <div className="mt-5">
          <GameUiHoverTip label={hoverTipText} className="block w-full">
            <div
              role="button"
              tabIndex={0}
              onClick={handleMatchupClick}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleMatchupClick();
                }
              }}
              aria-label={`${currentPost.title || currentEntity.nameKo}. ${hoverTipText}`}
              className={cn(
                "group/matchup relative cursor-pointer overflow-hidden rounded-xl border border-border/80 bg-zinc-950/70 p-3.5 transition-[border-color,box-shadow] duration-200 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary",
              )}
            >
              <div
                className={cn(
                  "grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 transition-opacity duration-200 motion-reduce:transition-none sm:gap-4",
                  fading && "opacity-0",
                )}
              >
                {/* Left: Original resource */}
                <div className="min-w-0">
                  <div className="mb-1 text-center font-game-text text-[11px] font-bold text-muted-foreground">
                    {serviceLocale === "ko" ? "원래 게임 요소" : "Original"}
                  </div>
                  <div className="flex justify-center">
                    <ThisOrThatResourcePanel
                      entity={currentEntity}
                      sideLabel=""
                      serviceLocale={serviceLocale}
                      gameLocale={gameLocale}
                      assetOnly
                    />
                  </div>
                </div>

                {/* Center: VS Animation badge */}
                <div className="flex flex-col items-center justify-center px-1">
                  <div className="font-game-title text-base font-black tracking-wider text-primary/90 transition-transform duration-200 group-hover/matchup:scale-110 sm:text-xl md:text-2xl">
                    VS
                  </div>
                  <span className="mt-0.5 text-[10px] font-bold text-muted-foreground/70">
                    {serviceLocale === "ko" ? "변형" : "Mod"}
                  </span>
                </div>

                {/* Right: Transfigured resource */}
                <div className="min-w-0">
                  <div className="mb-1 text-center font-game-text text-[11px] font-bold text-amber-300/80">
                    {currentPost.title || (serviceLocale === "ko" ? "변형 제안" : "Transfigured")}
                  </div>
                  <div className="flex justify-center">
                    <TransfigureResourcePreview
                      blocks={currentPost.content}
                      entities={entities}
                      entityMap={entityMap}
                      entity={currentEntity}
                      gameLocale={gameLocale}
                      serviceLocale={serviceLocale}
                      transformedName={currentPost.transformed_name}
                      transformedCost={currentPost.transformed_cost}
                      transformedStarCost={currentPost.transformed_star_cost}
                      transformedCardType={currentPost.transformed_card_type}
                      transformedCardRarity={currentPost.transformed_card_rarity}
                      transformedCardColor={currentPost.transformed_card_color}
                      cardKeywords={{
                        top: currentPost.card_top_keywords,
                        bottom: currentPost.card_bottom_keywords,
                      }}
                      transformedUpgradeCost={currentPost.transformed_upgrade_cost}
                      transformedUpgradeStarCost={currentPost.transformed_upgrade_star_cost}
                      omitEnergyCost={currentPost.omit_energy_cost}
                      upgradedBlocks={currentPost.upgraded_content}
                      upgradedCardKeywords={{
                        top: currentPost.upgraded_card_top_keywords,
                        bottom: currentPost.upgraded_card_bottom_keywords,
                      }}
                      upgradeLabel={serviceLocale === "ko" ? "강화" : "Upgrade"}
                      initialShowUpgrade={currentPost.show_upgrade}
                      showImageActions={false}
                      showUpgradeToggle={false}
                      tokenColor={currentPost.token_color}
                      tokenWax={currentPost.token_wax}
                    />
                  </div>
                </div>
              </div>

              {/* Bottom footer bar */}
              <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5 font-medium text-foreground/80">
                  <span>작성자: {currentPost.nickname}</span>
                </span>
                <span className="text-primary/90 group-hover/matchup:underline">
                  {hoverTipText} &rarr;
                </span>
              </div>
            </div>
          </GameUiHoverTip>
        </div>
      ) : null}
    </section>
  );
}
