"use client";

import { useCallback, useRef, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { IndexCardEngagement } from "@/components/index-card-engagement";
import { OwnPostMark } from "@/components/own-post-mark";
import { DecisionsDecisionsBoard } from "@/components/decisions-decisions/decisions-decisions-board";
import { GameScrollArea } from "@/components/game-scroll-area";
import { buildFavoriteTournamentCommentThreadKey } from "@/lib/comment-threads";
import { sortPoolRefs } from "@/lib/decisions-decisions";
import {
  FAVORITE_TOURNAMENT_HREF,
  isFavoriteTournamentBuiltinKey,
  type FavoriteTournamentPost,
} from "@/lib/favorite-tournament";
import {
  localizeHrefWithGameLocale,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import { worldcupPostTitle } from "@/components/this-or-that/favorite-tournament-title";
import { serviceMessages } from "@/messages/service";
import type { EntityInfo } from "@/components/patch-note-renderer";

const DRAG_THRESHOLD_PX = 6;

export function FavoriteTournamentPostCard({
  post,
  entityMap,
  isOwner = false,
  serviceLocale,
  gameLocale,
  userId,
  authReady = true,
  ensureUser,
  commentCount,
  likeCount,
  presetLabels,
}: {
  post: FavoriteTournamentPost;
  entityMap: Map<string, EntityInfo>;
  isOwner?: boolean;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  userId: string | null;
  authReady?: boolean;
  ensureUser?: () => Promise<string | null>;
  commentCount: number;
  likeCount: number;
  presetLabels: Record<string, string>;
}) {
  const copy = serviceMessages[serviceLocale].favoriteTournament;
  const router = useRouter();
  const href = localizeHrefWithGameLocale(
    `${FAVORITE_TOURNAMENT_HREF}/${post.id}`,
    serviceLocale,
    gameLocale,
  );
  const commentsHref = `${href}#comments`;
  const threadKey = buildFavoriteTournamentCommentThreadKey(post.id);
  const pool = sortPoolRefs(post.pool, entityMap);
  const builtin = isFavoriteTournamentBuiltinKey(post.preset_key);
  const title = worldcupPostTitle(post, serviceLocale, presetLabels, entityMap);
  const dragOrigin = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);

  const openPost = useCallback(() => {
    router.push(href);
  }, [href, router]);
  const handleClick = useCallback((event: MouseEvent<HTMLElement>) => {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    const target = event.target as HTMLElement;
    if (target.closest("[data-game-scroll-rail], [role='scrollbar']")) return;
    if (target.closest("a")) return;
    if (target.closest("button") && !target.closest("[data-favorite-tournament-thumb]")) return;
    openPost();
  }, [openPost]);
  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openPost();
  }, [openPost]);
  const handlePointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    dragOrigin.current = { x: event.clientX, y: event.clientY };
    dragged.current = false;
  }, []);
  const handlePointerMove = useCallback((event: PointerEvent<HTMLElement>) => {
    const origin = dragOrigin.current;
    if (!origin) return;
    if (
      Math.abs(event.clientX - origin.x) > DRAG_THRESHOLD_PX
      || Math.abs(event.clientY - origin.y) > DRAG_THRESHOLD_PX
    ) {
      dragged.current = true;
    }
  }, []);
  const handlePointerUp = useCallback(() => {
    dragOrigin.current = null;
  }, []);

  return (
    <article
      role="link"
      tabIndex={0}
      aria-label={title}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="group cursor-pointer transition-[transform,box-shadow] duration-200 hover:-translate-y-1 focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary/70 motion-reduce:transform-none"
    >
      <div
        data-favorite-tournament-thumb
        className="aspect-video overflow-hidden rounded-xl bg-muted/40 shadow-sm transition-shadow duration-200 group-hover:shadow-[0_12px_28px_rgba(15,15,15,0.16)]"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <GameScrollArea
          className="h-full"
          size="small"
          aria-label={copy.thumbnailScroll}
        >
          <div className="origin-top scale-[0.72] sm:scale-[0.78]">
            <DecisionsDecisionsBoard
              variant="pool"
              rows={[]}
              placements={[]}
              pool={pool}
              entitiesByKey={entityMap}
              serviceLocale={serviceLocale}
              gameLocale={gameLocale}
              showNames={false}
              selectedKey={null}
              readOnly
              compact
              thumbnail
              disablePreview
            />
          </div>
        </GameScrollArea>
      </div>
      <div className="mt-3 flex items-start gap-3">
        {!builtin && (
          <span className="w-16 shrink-0 truncate pt-0.5 text-xs text-muted-foreground">
            {post.nickname}
            {isOwner && <OwnPostMark />}
          </span>
        )}
        <h2 className="min-w-0 flex-1 line-clamp-2 font-service text-[15px] font-semibold leading-snug text-foreground">
          {title}
        </h2>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <IndexCardEngagement
            commentsHref={commentsHref}
            commentCount={commentCount}
            likeStoryId={threadKey}
            likeCount={likeCount}
            userId={userId}
            authReady={authReady}
            ensureUser={ensureUser}
          />
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {copy.playCount.replace("{count}", String(post.play_count ?? 0))}
          </span>
        </div>
      </div>
    </article>
  );
}
