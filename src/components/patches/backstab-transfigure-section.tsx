"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Heart, MessageSquare, Sparkles } from "lucide-react";
import { GameUiHoverTip } from "@/components/game-ui-hover-tip";
import { RichText } from "@/components/rich-text";
import { DisplayedProfileNickname } from "@/components/profile/displayed-profile-nickname";
import { PostRenderer } from "@/components/chemicalx/post-renderer";
import { TransfigureResourcePreview } from "@/components/transfigure/transfigure-resource-preview";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { useTransfigurePosts } from "@/hooks/use-transfigure-posts";
import { useStoredProfileSnapshot } from "@/hooks/use-user-profile";
import {
  localizeHrefWithGameLocale,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import type { TransfigurePost } from "@/lib/transfigure-types";
import { serviceMessages } from "@/messages/service";
import { formatTimeAgo } from "@/lib/relative-time";
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
  transfigureTitle,
  transfigureLead,
  transfigureCta,
}: {
  entities: EntityInfo[];
  entityMap: Map<string, EntityInfo>;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  transfigureTitle: string;
  transfigureLead: string;
  transfigureCta: string;
}) {
  const { posts: livePosts, likeCounts, commentCounts } = useTransfigurePosts(null, "recommended");
  const { profile } = useStoredProfileSnapshot();

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

  const activePost = posts[postIndex % posts.length] ?? posts[0];
  if (!activePost) return null;

  const resource = entityMap.get(
    `${activePost.resource_type}:${activePost.resource_id}`,
  );
  const copy = serviceMessages[serviceLocale].transfigure;
  const dateLocale = serviceLocale === "ko" ? "ko-KR" : "en-US";
  const upgradeLabel = serviceLocale === "ko" ? "강화" : "Upgrade";
  const postHref = localizeHrefWithGameLocale(
    `/transfigure/${activePost.id}`,
    serviceLocale,
    gameLocale,
  );
  const transfigureRootHref = localizeHrefWithGameLocale(
    "/transfigure",
    serviceLocale,
    gameLocale,
  );

  const isOwner = Boolean(
    profile.userId && activePost.user_id && profile.userId === activePost.user_id,
  );
  const likeCount = likeCounts[activePost.id] ?? 0;
  const commentCount = commentCounts[activePost.id] ?? 0;

  return (
    <div className="mt-10">
      {/* Header with Title and CTA link */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-game-title text-xl font-bold tracking-wide text-foreground">
          {transfigureTitle}
        </h2>
        <Link
          href={transfigureRootHref}
          className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          <span>{transfigureCta}</span>
          <span aria-hidden="true">&rarr;</span>
        </Link>
      </div>

      {/* Hero Tinker Time lead quote */}
      <div className="mt-2 text-sm font-medium leading-relaxed text-rose-50/90">
        <RichText text={transfigureLead} />
      </div>

      {/* Transfigure Index Card Asset Preview */}
      <div className="mt-6 flex justify-center">
        <Link
          href={postHref}
          className="block w-full max-w-sm sm:max-w-md group"
          aria-label={`${activePost.title || resource?.nameKo || activePost.resource_id} - ${serviceLocale === "ko" ? "변형으로 이동하기" : "Go to Transfigure"}`}
        >
          <GameUiHoverTip
            content={serviceLocale === "ko" ? "변형으로 이동하기" : "Go to Transfigure"}
          >
            <div
              className={cn(
                "transition-opacity duration-200",
                fading ? "opacity-0" : "opacity-100",
              )}
            >
              <article className="flex h-full flex-col rounded-lg border border-border bg-card/25 px-4 py-4 transition-[border-color,background-color,box-shadow,transform] duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:bg-card/35 group-hover:shadow-lg group-hover:shadow-black/25 motion-reduce:transform-none">
                {/* Card Top: Title, Date, Engagement */}
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-2 font-game-title text-base font-semibold leading-snug spire-gold">
                      {activePost.title?.trim() || resource?.nameKo || activePost.resource_id}
                    </h3>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {formatTimeAgo(activePost.created_at, copy, dateLocale)}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <MessageSquare className="h-3.5 w-3.5 text-muted-foreground/80" aria-hidden="true" />
                      <span>{commentCount}</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Heart className="h-3.5 w-3.5 text-rose-400/80" aria-hidden="true" />
                      <span>{likeCount}</span>
                    </span>
                  </div>
                </div>

                {/* Card Center: Transfigure Asset Preview */}
                <div
                  className="flex min-h-[22rem] sm:min-h-[26rem] flex-1 items-center justify-center overflow-hidden rounded-md bg-black/15 px-2 py-3"
                  data-transfigure-post-asset
                >
                  {resource ? (
                    <TransfigureResourcePreview
                      blocks={activePost.content}
                      entities={entities}
                      entityMap={entityMap}
                      entity={resource}
                      gameLocale={gameLocale}
                      serviceLocale={serviceLocale}
                      transformedName={activePost.transformed_name}
                      transformedCost={activePost.transformed_cost}
                      transformedStarCost={activePost.transformed_star_cost}
                      transformedCardType={activePost.transformed_card_type}
                      transformedCardRarity={activePost.transformed_card_rarity}
                      transformedCardColor={activePost.transformed_card_color}
                      cardKeywords={{
                        top: activePost.card_top_keywords,
                        bottom: activePost.card_bottom_keywords,
                      }}
                      transformedUpgradeCost={activePost.transformed_upgrade_cost}
                      transformedUpgradeStarCost={activePost.transformed_upgrade_star_cost}
                      omitEnergyCost={activePost.omit_energy_cost}
                      upgradedBlocks={activePost.upgraded_content}
                      upgradedCardKeywords={{
                        top: activePost.upgraded_card_top_keywords,
                        bottom: activePost.upgraded_card_bottom_keywords,
                      }}
                      upgradeLabel={upgradeLabel}
                      initialShowUpgrade={activePost.show_upgrade}
                      showImageActions={false}
                      showUpgradeToggle={false}
                      tokenColor={activePost.token_color}
                      tokenWax={activePost.token_wax}
                    />
                  ) : (
                    <div className="flex max-w-full flex-col items-center gap-3 text-sm leading-relaxed text-[#f0e6d2]">
                      <Sparkles className="h-8 w-8 text-primary/70" aria-hidden="true" />
                      <PostRenderer
                        blocks={activePost.show_upgrade && activePost.upgraded_content
                          ? activePost.upgraded_content
                          : activePost.content}
                        entityMap={entityMap}
                        serviceLocale={serviceLocale}
                        gameLocale={gameLocale}
                      />
                    </div>
                  )}
                </div>

                {/* Card Footer: Own post chip & author nickname */}
                <div className="mt-3 flex items-center justify-end gap-1.5 pt-1">
                  {isOwner && (
                    <span className="inline-flex shrink-0 items-center rounded border border-[#efc851]/35 px-1.5 py-px text-[10px] font-semibold leading-none text-[#efc851]/90">
                      {serviceLocale === "ko" ? "내 글" : "My Post"}
                    </span>
                  )}
                  <DisplayedProfileNickname
                    nickname={activePost.nickname}
                    isOwner={isOwner}
                    authorToken={activePost}
                    size={14}
                    className="max-w-[70%]"
                    tokenClassName="h-3.5 w-3.5"
                    nicknameClassName="text-[11px] text-muted-foreground/80"
                  />
                </div>
              </article>
            </div>
          </GameUiHoverTip>
        </Link>
      </div>
    </div>
  );
}
