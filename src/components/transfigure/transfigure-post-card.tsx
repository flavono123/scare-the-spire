"use client";

import { useCallback, type KeyboardEvent, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { PostRenderer } from "@/components/chemicalx/post-renderer";
import { IndexCardEngagement } from "@/components/index-card-engagement";
import { OwnPostMark } from "@/components/own-post-mark";
import { TransfigureResourcePreview } from "@/components/transfigure/transfigure-resource-preview";
import { buildTransfigureCommentThreadKey } from "@/lib/comment-threads";
import {
  localizeHrefWithGameLocale,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import type { TransfigurePost } from "@/lib/transfigure-types";
import { serviceMessages } from "@/messages/service";
import { formatTimeAgo } from "@/lib/relative-time";

interface TransfigurePostCardProps {
  post: TransfigurePost;
  entities: EntityInfo[];
  entityMap: Map<string, EntityInfo>;
  isOwner?: boolean;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  upgradeLabel: string;
  userId: string | null;
  authReady?: boolean;
  ensureUser?: () => Promise<string | null>;
  commentCount: number;
  likeCount: number;
}

export function TransfigurePostCard({
  post,
  entities,
  entityMap,
  isOwner = false,
  serviceLocale,
  gameLocale,
  upgradeLabel,
  userId,
  authReady = true,
  ensureUser,
  commentCount,
  likeCount,
}: TransfigurePostCardProps) {
  const copy = serviceMessages[serviceLocale].transfigure;
  const dateLocale = serviceLocale === "ko" ? "ko-KR" : "en-US";
  const resource = entityMap.get(`${post.resource_type}:${post.resource_id}`);
  const router = useRouter();
  const href = localizeHrefWithGameLocale(
    `/transfigure/${post.id}`,
    serviceLocale,
    gameLocale,
  );
  const commentsHref = `${href}#comments`;
  const threadKey = buildTransfigureCommentThreadKey(post.id);
  const openPost = useCallback(() => {
    router.push(href);
  }, [href, router]);
  const handleClick = useCallback((event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("a, button, [role='button']")) return;
    openPost();
  }, [openPost]);
  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openPost();
  }, [openPost]);

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="flex h-full cursor-pointer flex-col rounded-lg border border-border bg-card/25 px-4 py-4 transition-[transform,border-color,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-yellow-500/25 hover:bg-card/35 hover:shadow-lg hover:shadow-black/25 focus-visible:outline focus-visible:outline-1 focus-visible:outline-yellow-300/70 active:translate-y-0 motion-reduce:transform-none"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-2 font-game-title text-base font-semibold leading-snug spire-gold">
            {post.title?.trim() || resource?.nameKo || post.resource_id}
          </h2>
          <span className="mt-1 block text-xs text-muted-foreground">
            {formatTimeAgo(post.created_at, copy, dateLocale)}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <IndexCardEngagement
            commentsHref={commentsHref}
            commentCount={commentCount}
            likeStoryId={threadKey}
            likeCount={likeCount}
            userId={userId}
            authReady={authReady}
            ensureUser={ensureUser}
          />
        </div>
      </div>

      <div
        className="flex min-h-[24rem] flex-1 items-center justify-center overflow-hidden rounded-md bg-black/15 px-2 py-3 sm:min-h-[28rem]"
        data-transfigure-post-asset
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
            cardKeywords={{
              top: post.card_top_keywords,
              bottom: post.card_bottom_keywords,
            }}
            transformedUpgradeCost={post.transformed_upgrade_cost}
            transformedUpgradeStarCost={post.transformed_upgrade_star_cost}
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
            <Sparkles className="h-8 w-8 text-yellow-200/70" aria-hidden="true" />
            <PostRenderer
              blocks={post.show_upgrade && post.upgraded_content
                ? post.upgraded_content
                : post.content}
              entityMap={entityMap}
              serviceLocale={serviceLocale}
              gameLocale={gameLocale}
            />
          </div>
        )}
      </div>

      <div className="mt-auto flex items-center justify-end gap-1.5 pt-2">
        {isOwner && <OwnPostMark />}
        <span className="max-w-[70%] truncate text-[11px] text-muted-foreground/80">
          {post.nickname}
        </span>
      </div>
    </article>
  );
}
