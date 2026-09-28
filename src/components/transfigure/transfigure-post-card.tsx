"use client";

import { useCallback, useMemo, type KeyboardEvent, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { DisplayedProfileNickname } from "@/components/profile/displayed-profile-nickname";
import { IndexCardEngagement } from "@/components/index-card-engagement";
import { OwnPostMark } from "@/components/own-post-mark";
import { TransfigureVariantPreview } from "@/components/transfigure/transfigure-variant-preview";
import { TransfigureVariantReel } from "@/components/transfigure/transfigure-variant-reel";
import { buildTransfigureCommentThreadKey } from "@/lib/comment-threads";
import {
  localizeHrefWithGameLocale,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import {
  transfigurePostVariants,
  type TransfigurePost,
} from "@/lib/transfigure-types";
import { serviceMessages } from "@/messages/service";
import { formatTimeAgo } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import { indexItemIsRead, indexReadClass, useIndexSeenAt } from "@/hooks/use-index-read";

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
  className?: string;
  readOnlyEngagement?: boolean;
  /** `representative` keeps outer reels (patch previewreel) from nesting another reel. */
  variantDisplay?: "reel" | "representative";
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
  className,
  readOnlyEngagement = false,
  variantDisplay = "reel",
}: TransfigurePostCardProps) {
  const copy = serviceMessages[serviceLocale].transfigure;
  const seenAt = useIndexSeenAt("transfigure");
  const dateLocale = serviceLocale === "ko" ? "ko-KR" : "en-US";
  const resource = entityMap.get(`${post.resource_type}:${post.resource_id}`);
  const variants = useMemo(() => transfigurePostVariants(post), [post]);
  const playReel = variantDisplay === "reel" && variants.length > 1;
  let router: ReturnType<typeof useRouter> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    router = useRouter();
  } catch {
    router = null;
  }
  const href = localizeHrefWithGameLocale(
    `/transfigure/${post.id}`,
    serviceLocale,
    gameLocale,
  );
  const commentsHref = `${href}#comments`;
  const threadKey = buildTransfigureCommentThreadKey(post.id);
  const openPost = useCallback(() => {
    if (router) {
      router.push(href);
    } else if (typeof window !== "undefined") {
      window.location.href = href;
    }
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
      className={cn(
        "flex h-full cursor-pointer flex-col rounded-lg border border-border bg-card/25 px-4 py-4 transition-[transform,border-color,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-card/35 hover:shadow-lg hover:shadow-black/25 focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary/70 active:translate-y-0 motion-reduce:transform-none",
        className,
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className={`line-clamp-2 font-game-title text-base font-semibold leading-snug spire-gold ${indexReadClass(indexItemIsRead(post.created_at, seenAt))}`}>
            {post.title?.trim() || resource?.nameKo || post.resource_id}
          </h2>
          <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>{formatTimeAgo(post.created_at, copy, dateLocale)}</span>
            {variants.length > 1 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-primary/70" data-transfigure-variant-badge="">
                  {copy.variantCount.replace("{count}", String(variants.length))}
                </span>
              </>
            )}
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
            readOnly={readOnlyEngagement}
          />
        </div>
      </div>

      <div
        className="flex min-h-[24rem] flex-1 items-center justify-center overflow-hidden rounded-md bg-black/15 px-2 py-3 sm:min-h-[28rem]"
        data-transfigure-post-asset
        data-transfigure-variant-count={variants.length}
      >
        {playReel ? (
          <TransfigureVariantReel
            count={variants.length}
            slideLabel={(index) => copy.variantSlideLabel.replace(
              "{index}",
              String(index + 1),
            )}
            renderSlide={(index) => (
              <TransfigureVariantPreview
                variant={variants[index]!}
                entities={entities}
                entityMap={entityMap}
                gameLocale={gameLocale}
                serviceLocale={serviceLocale}
                upgradeLabel={upgradeLabel}
              />
            )}
          />
        ) : (
          <TransfigureVariantPreview
            variant={variants[0]!}
            entities={entities}
            entityMap={entityMap}
            gameLocale={gameLocale}
            serviceLocale={serviceLocale}
            upgradeLabel={upgradeLabel}
          />
        )}
      </div>

      <div className="mt-auto flex items-center justify-end gap-1.5 pt-2">
        {isOwner && <OwnPostMark />}
        <DisplayedProfileNickname
          nickname={post.nickname}
          isOwner={isOwner}
          authorToken={post}
          size={14}
          className="max-w-[70%]"
          tokenClassName="h-3.5 w-3.5"
          nicknameClassName="text-[11px] text-muted-foreground/80"
        />
      </div>
    </article>
  );
}
