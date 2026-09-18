"use client";

import Link from "next/link";
import Image from "@/components/ui/static-image";
import { Heart, MessageSquare, Sparkles } from "lucide-react";
import { GameUiHoverTip } from "@/components/game-ui-hover-tip";
import { RichText } from "@/components/rich-text";
import { DisplayedProfileNickname } from "@/components/profile/displayed-profile-nickname";
import { PostRenderer } from "@/components/chemicalx/post-renderer";
import { TransfigureResourcePreview } from "@/components/transfigure/transfigure-resource-preview";
import type { EntityInfo } from "@/components/patch-note-renderer";
import {
  localizeHrefWithGameLocale,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import type { TransfigurePost } from "@/lib/transfigure-types";
import { serviceMessages } from "@/messages/service";
import { formatTimeAgo } from "@/lib/relative-time";
import { cn } from "@/lib/utils";

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
  const copy = serviceMessages[serviceLocale].transfigure;
  const dateLocale = serviceLocale === "ko" ? "ko-KR" : "en-US";
  const upgradeLabel = serviceLocale === "ko" ? "강화" : "Upgrade";
  const hoverTipText = serviceLocale === "ko" ? "변형으로 이동하기" : "Go to Transfigure";
  const transfigureRootHref = localizeHrefWithGameLocale(
    "/transfigure",
    serviceLocale,
    gameLocale,
  );

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
          data-transfigure-preview-stack=""
          className="relative w-full max-w-sm sm:max-w-md"
        >
          {BUILTIN_SAMPLE_TRANSFIGURES.map((post, index) => {
            const resource = entityMap.get(
              `${post.resource_type}:${post.resource_id}`,
            );
            const postHref = localizeHrefWithGameLocale(
              `/transfigure/${post.id}`,
              serviceLocale,
              gameLocale,
            );
            const isFirst = index === 0;

            return (
              <div
                key={post.id}
                data-transfigure-card=""
                className={cn(
                  "w-full transition-opacity duration-300",
                  isFirst
                    ? "relative opacity-100 pointer-events-auto"
                    : "absolute inset-0 opacity-0 pointer-events-none",
                )}
              >
                <Link
                  href={postHref}
                  className="block w-full group"
                  aria-label={`${post.title || resource?.nameKo || post.resource_id} - ${hoverTipText}`}
                >
                  <GameUiHoverTip content={hoverTipText}>
                    <article className="flex h-full flex-col rounded-lg border border-border bg-card/25 px-4 py-4 transition-[border-color,background-color,box-shadow,transform] duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:bg-card/35 group-hover:shadow-lg group-hover:shadow-black/25 motion-reduce:transform-none">
                      {/* Card Top: Title, Date, Engagement */}
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="line-clamp-2 font-game-title text-base font-semibold leading-snug spire-gold">
                            {post.title?.trim() || resource?.nameKo || post.resource_id}
                          </h3>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {formatTimeAgo(post.created_at, copy, dateLocale)}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground/80" aria-hidden="true" />
                            <span>1</span>
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Heart className="h-3.5 w-3.5 text-rose-400/80" aria-hidden="true" />
                            <span>3</span>
                          </span>
                        </div>
                      </div>

                      {/* Card Center: Transfigure Asset Preview */}
                      <div
                        className="flex min-h-[22rem] sm:min-h-[26rem] flex-1 items-center justify-center overflow-hidden rounded-md bg-black/15 px-2 py-3"
                        data-transfigure-post-asset=""
                      >
                        {resource ? (
                          <TransfigureResourcePreview
                            blocks={post.content}
                            entities={entities}
                            entityMap={entityMap}
                            entity={resource}
                            gameLocale={gameLocale}
                            serviceLocale={serviceLocale}
                            transformedName={post.transformed_name}
                            transformedCost={post.transformed_cost}
                            transformedStarCost={post.transformed_star_cost}
                            transformedCardType={post.transformed_card_type}
                            transformedCardRarity={post.transformed_card_rarity}
                            transformedCardColor={post.transformed_card_color}
                            cardKeywords={{
                              top: post.card_top_keywords,
                              bottom: post.card_bottom_keywords,
                            }}
                            transformedUpgradeCost={post.transformed_upgrade_cost}
                            transformedUpgradeStarCost={post.transformed_upgrade_star_cost}
                            omitEnergyCost={post.omit_energy_cost}
                            upgradedBlocks={post.upgraded_content}
                            upgradedCardKeywords={{
                              top: post.upgraded_card_top_keywords,
                              bottom: post.upgraded_card_bottom_keywords,
                            }}
                            upgradeLabel={upgradeLabel}
                            initialShowUpgrade={post.show_upgrade}
                            showImageActions={false}
                            showUpgradeToggle={false}
                            tokenColor={post.token_color}
                            tokenWax={post.token_wax}
                          />
                        ) : (
                          <div className="flex max-w-full flex-col items-center gap-3 text-sm leading-relaxed text-[#f0e6d2]">
                            <Sparkles className="h-8 w-8 text-primary/70" aria-hidden="true" />
                            <PostRenderer
                              blocks={post.content}
                              entityMap={entityMap}
                              serviceLocale={serviceLocale}
                              gameLocale={gameLocale}
                            />
                          </div>
                        )}
                      </div>

                      {/* Card Footer: Author nickname */}
                      <div className="mt-3 flex items-center justify-end gap-1.5 pt-1">
                        <DisplayedProfileNickname
                          nickname={post.nickname}
                          isOwner={false}
                          authorToken={post}
                          size={14}
                          className="max-w-[70%]"
                          tokenClassName="h-3.5 w-3.5"
                          nicknameClassName="text-[11px] text-muted-foreground/80"
                        />
                      </div>
                    </article>
                  </GameUiHoverTip>
                </Link>
              </div>
            );
          })}
        </div>

        {/* Self-contained client animation script: works in both Next.js and static patch worker */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  var stack = document.querySelector("[data-transfigure-preview-stack]");
  if (!stack) return;
  var cards = stack.querySelectorAll("[data-transfigure-card]");
  if (cards.length < 2) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var current = 0;
  setInterval(function() {
    if (document.hidden) return;
    var next = Math.floor(Math.random() * cards.length);
    while (next === current && cards.length > 1) {
      next = Math.floor(Math.random() * cards.length);
    }
    cards[current].classList.remove("opacity-100", "pointer-events-auto", "relative");
    cards[current].classList.add("opacity-0", "pointer-events-none", "absolute", "inset-0");
    cards[next].classList.remove("opacity-0", "pointer-events-none", "absolute", "inset-0");
    cards[next].classList.add("opacity-100", "pointer-events-auto", "relative");
    current = next;
  }, 2800);
})();
`,
          }}
        />
      </div>
    </div>
  );
}
