"use client";

import { useCallback, useMemo, useState } from "react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { ContentLoadingNotice } from "@/components/content-loading-notice";
import {
  DEFRAGMENT_ENGAGE_COL_CLASS,
  DEFRAGMENT_TYPE_COL_CLASS,
  DefragmentIndexRow,
} from "@/components/defragment/defragment-index-row";
import {
  DefragmentWritePanel,
  type DefragmentWritePlaceholders,
} from "@/components/defragment/defragment-write-panel";
import { FeedLoadMoreSentinel } from "@/components/feed-load-more-sentinel";
import { FeedSortToggle } from "@/components/feed-sort-toggle";
import { RichText } from "@/components/rich-text";
import { StorageUnavailableNotice } from "@/components/storage-unavailable-notice";
import Image from "@/components/ui/static-image";
import { useAuth } from "@/hooks/use-auth";
import { useDefragmentFeed } from "@/hooks/use-defragment-feed";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { useThisOrThatLikes } from "@/hooks/use-this-or-that-likes";
import { useUserProfile } from "@/hooks/use-user-profile";
import { getTransfigureNavTitle } from "@/lib/borrowed-game-copy";
import {
  DEFRAGMENT_TOKEN_SRC,
  type DefragmentFeedItem,
  type DefragmentFederatedService,
} from "@/lib/defragment";
import type { GameLocale } from "@/lib/i18n";
import { DEFAULT_TOYBOX_FEED_SORT, type ToyboxFeedSort } from "@/lib/toybox-feed";
import { DEFAULT_USER_PROFILE } from "@/lib/user-profile";
import { serviceMessages } from "@/messages/service";

export function DefragmentClient({
  entities,
  gameLocale,
  title,
  subtitle,
  placeholders,
  upgradeLabel,
}: {
  entities: EntityInfo[];
  gameLocale: GameLocale;
  title: string;
  subtitle: string;
  placeholders: DefragmentWritePlaceholders;
  upgradeLabel: string;
}) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].defragment;
  const nav = serviceMessages[serviceLocale].nav;
  const { userId, ready, ensureUser } = useAuth();
  const [sort, setSort] = useState<ToyboxFeedSort>(DEFAULT_TOYBOX_FEED_SORT);
  const [composerOpen, setComposerOpen] = useState(false);
  const {
    items,
    loading,
    loadingMore,
    hasMore,
    unavailable,
    loadMore,
    prependItem,
    setUnavailable,
  } = useDefragmentFeed(sort);
  const profileFallback = useMemo(
    () => ({ ...DEFAULT_USER_PROFILE, nickname: copy.defaultNickname }),
    [copy.defaultNickname],
  );
  const { profile } = useUserProfile(profileFallback);

  const typeLabels = useMemo<Record<DefragmentFederatedService, string>>(() => ({
    combo: nav.combo,
    transfigure: getTransfigureNavTitle(gameLocale),
    this_or_that: nav.thisOrThat,
    chemical_x: nav.chemicalX,
  }), [gameLocale, nav.chemicalX, nav.combo, nav.thisOrThat]);

  const totIds = useMemo(
    () => items.filter((item) => item.service === "this_or_that").map((item) => item.id),
    [items],
  );
  const totSeedCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      if (item.service === "this_or_that") counts[item.id] = item.likeCount;
    }
    return counts;
  }, [items]);
  const totLikes = useThisOrThatLikes(totIds, userId, totSeedCounts);

  const handleToggleTotLike = useCallback(async (postId: string) => {
    const activeUserId = userId ?? await ensureUser();
    if (!activeUserId) return;
    await totLikes.toggle(postId, activeUserId);
  }, [ensureUser, totLikes, userId]);

  const handleCreated = useCallback((item: DefragmentFeedItem) => {
    prependItem(item);
    setComposerOpen(false);
  }, [prependItem]);

  return (
    <div data-defragment-page="index" className="space-y-6">
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src={DEFRAGMENT_TOKEN_SRC}
              alt={title}
              width={52}
              height={52}
              className="object-contain drop-shadow-[0_0_16px_rgba(56,176,227,0.28)]"
            />
            <h1 className="spire-gold truncate font-service text-xl font-bold">
              {title}
            </h1>
          </div>
          {ready && !unavailable && (
            <button
              type="button"
              aria-expanded={composerOpen}
              onClick={() => setComposerOpen((open) => !open)}
              className="group/create inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-yellow-300/30 bg-yellow-500/10 px-3 py-2 text-xs font-semibold text-yellow-100 shadow-[0_0_18px_rgba(239,200,81,0.06)] transition-[transform,border-color,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-yellow-200/50 hover:bg-yellow-500/15 hover:shadow-[0_6px_22px_rgba(239,200,81,0.1)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-yellow-300/70 active:translate-y-0 motion-reduce:transform-none"
            >
              <Image
                src={DEFRAGMENT_TOKEN_SRC}
                alt=""
                width={18}
                height={18}
                className="object-contain transition-transform duration-200 group-hover/create:rotate-12 motion-reduce:transform-none"
              />
              {copy.create}
            </button>
          )}
        </div>
        <div className="max-w-xl font-game-text text-sm leading-relaxed text-zinc-400">
          <RichText text={subtitle} />
        </div>
      </header>

      {composerOpen && ready && !unavailable && (
        <DefragmentWritePanel
          entities={entities}
          gameLocale={gameLocale}
          placeholders={placeholders}
          upgradeLabel={upgradeLabel}
          profileNickname={profile.nickname}
          typeLabels={typeLabels}
          onCreated={handleCreated}
          onUnavailable={() => setUnavailable(true)}
          ensureUser={ensureUser}
          userId={userId}
          authReady={ready}
        />
      )}

      {!loading && !unavailable && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FeedSortToggle
            sort={sort}
            onSortChange={setSort}
            labels={serviceMessages[serviceLocale].feedSort}
          />
          <span className="text-xs text-gray-500">
            {copy.count.replace("{count}", String(items.length))}
          </span>
        </div>
      )}

      {unavailable ? (
        <StorageUnavailableNotice title={copy.unavailableTitle} />
      ) : loading ? (
        <ContentLoadingNotice label={copy.loading} />
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{copy.empty}</p>
      ) : (
        <div className="overflow-visible border-l-2 border-[rgba(56,176,227,0.42)] pl-2">
          <div className="flex items-center gap-2 border-b border-yellow-500/15 px-1 py-1 text-[11px] font-semibold tracking-wide text-zinc-500">
            <span className={DEFRAGMENT_TYPE_COL_CLASS}>{copy.boardType}</span>
            <span className="min-w-0 flex-1">{copy.boardTitle}</span>
            <span className={`${DEFRAGMENT_ENGAGE_COL_CLASS} text-right`}>
              {copy.boardLikes} · {copy.boardComments}
            </span>
          </div>
          {items.map((item) => (
            <DefragmentIndexRow
              key={`${item.service}:${item.id}`}
              item={item}
              typeLabel={typeLabels[item.service]}
              gameLocale={gameLocale}
              userId={userId}
              authReady={ready}
              ensureUser={ensureUser}
              totLiked={totLikes.liked.has(item.id)}
              totLikesLoading={totLikes.loading}
              totLikesUnavailable={totLikes.unavailable}
              totLikeCount={totLikes.counts[item.id] ?? item.likeCount}
              onToggleTotLike={handleToggleTotLike}
            />
          ))}
          <FeedLoadMoreSentinel
            hasMore={hasMore}
            loadingMore={loadingMore}
            disabled={unavailable}
            extraKey={items.length}
            label={copy.loadingMore}
            onLoadMore={() => { void loadMore(); }}
          />
        </div>
      )}
    </div>
  );
}
