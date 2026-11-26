"use client";

import { useState } from "react";
import Link from "next/link";
import { ContentLoadingNotice } from "@/components/content-loading-notice";
import { DecisionsDecisionsPostCard } from "@/components/decisions-decisions/decisions-decisions-post-card";
import { FeedLoadMoreSentinel } from "@/components/feed-load-more-sentinel";
import { FeedSortToggle } from "@/components/feed-sort-toggle";
import { StorageUnavailableNotice } from "@/components/storage-unavailable-notice";
import { ToyBoxIndexHeading } from "@/components/toybox-index-heading";
import Image from "@/components/ui/static-image";
import { useAuth } from "@/hooks/use-auth";
import { useDecisionsDecisionsCatalog } from "@/hooks/use-decisions-decisions-catalog";
import { useDecisionsDecisionsPosts } from "@/hooks/use-decisions-decisions-posts";
import { useServiceLocale } from "@/hooks/use-service-locale";
import type { DecisionsDecisionsGameCopy } from "@/lib/borrowed-game-copy";
import {
  DECISIONS_DECISIONS_TOKEN_SRC,
  DECISIONS_DECISIONS_WRITE_HREF,
  placedPool,
  sortPoolRefs,
} from "@/lib/decisions-decisions";
import { localizeHrefWithGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_TOYBOX_FEED_SORT, type ToyboxFeedSort } from "@/lib/toybox-feed";
import { serviceMessages } from "@/messages/service";

export function DecisionsDecisionsClient({
  gameLocale,
  gameCopy,
}: {
  gameLocale: GameLocale;
  gameCopy: DecisionsDecisionsGameCopy;
}) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].decisionsDecisions;
  const { userId, ready, ensureUser } = useAuth();
  const [sort, setSort] = useState<ToyboxFeedSort>(DEFAULT_TOYBOX_FEED_SORT);
  const catalog = useDecisionsDecisionsCatalog(gameLocale, { includeLegacy: true });
  const {
    posts,
    likeCounts,
    commentCounts,
    loading,
    loadingMore,
    hasMore,
    unavailable,
    loadMore,
  } = useDecisionsDecisionsPosts(sort);
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-4">
        <Image
          src={DECISIONS_DECISIONS_TOKEN_SRC}
          alt={gameCopy.title}
          width={52}
          height={52}
          className="size-[52px] shrink-0 object-contain drop-shadow"
        />
        <div className="min-w-0">
          <h1 className="font-service text-xl font-bold spire-gold sm:text-3xl">
            {gameCopy.title}
          </h1>
        </div>
        {ready && !unavailable && (
          <Link
            href={localizeHrefWithGameLocale(DECISIONS_DECISIONS_WRITE_HREF, serviceLocale, gameLocale)}
            className="group/create ml-auto inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 text-xs font-semibold text-primary shadow-[0_0_18px_rgba(239,200,81,0.06)] transition-[transform,border-color,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/15 hover:shadow-[0_6px_22px_rgba(239,200,81,0.1)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary/70 active:translate-y-0 motion-reduce:transform-none"
          >
            <Image
              src={DECISIONS_DECISIONS_TOKEN_SRC}
              alt=""
              width={16}
              height={16}
              className="object-contain transition-transform duration-200 group-hover/create:rotate-12 motion-reduce:transform-none"
            />
            {copy.create}
          </Link>
        )}
        </div>
        <ToyBoxIndexHeading
          subtitle={copy.subtitle}
          hero={gameCopy.hero}
        />
      </header>

      {!loading && !unavailable && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FeedSortToggle
            service="decisions_decisions"
            sort={sort}
            onSortChange={setSort}
            labels={serviceMessages[serviceLocale].feedSort}
          />
          <span className="text-xs text-gray-500">
            {copy.count.replace("{count}", String(posts.length))}
          </span>
        </div>
      )}

      {unavailable ? (
        <StorageUnavailableNotice title={copy.unavailableTitle} />
      ) : loading || catalog.loading ? (
        <ContentLoadingNotice label={copy.loading} />
      ) : (
        <div className="space-y-3">
          {posts.length === 0 && (
            <p className="text-sm text-muted-foreground">{copy.empty}</p>
          )}
          {posts.map((post) => {
            const pool = sortPoolRefs(
              placedPool(post.placements),
              catalog.entityMap,
            );
            return (
              <DecisionsDecisionsPostCard
                key={post.id}
                post={post}
                entityMap={catalog.entityMap}
                pool={pool}
                isOwner={Boolean(userId && post.user_id === userId)}
                serviceLocale={serviceLocale}
                gameLocale={gameLocale}
                userId={userId}
                authReady={ready}
                ensureUser={ensureUser}
                commentCount={commentCounts[post.id] ?? 0}
                likeCount={likeCounts[post.id] ?? 0}
              />
            );
          })}
          <FeedLoadMoreSentinel
            hasMore={hasMore}
            loadingMore={loadingMore}
            disabled={unavailable}
            extraKey={posts.length}
            label={copy.loadingMore}
            onLoadMore={() => { void loadMore(); }}
          />
        </div>
      )}
    </div>
  );
}
