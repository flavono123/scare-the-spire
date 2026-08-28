"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ContentLoadingNotice } from "@/components/content-loading-notice";
import { FeedLoadMoreSentinel } from "@/components/feed-load-more-sentinel";
import { FeedSortToggle } from "@/components/feed-sort-toggle";
import { StorageUnavailableNotice } from "@/components/storage-unavailable-notice";
import { FavoriteTournamentPostCard } from "@/components/this-or-that/favorite-tournament-post-card";
import { ThisOrThatServiceTabs } from "@/components/this-or-that/this-or-that-service-tabs";
import { ToyBoxIndexHeading } from "@/components/toybox-index-heading";
import Image from "@/components/ui/static-image";
import { useAuth } from "@/hooks/use-auth";
import { useDecisionsDecisionsCatalog } from "@/hooks/use-decisions-decisions-catalog";
import {
  useFavoriteTournamentPosts,
  type SaveFavoriteTournamentInput,
} from "@/hooks/use-favorite-tournament-posts";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { useUserProfile } from "@/hooks/use-user-profile";
import { FAVORITE_TOURNAMENT_TOKEN_SRC } from "@/lib/favorite-tournament";
import type { GameLocale } from "@/lib/i18n";
import { DEFAULT_TOYBOX_FEED_SORT, type ToyboxFeedSort } from "@/lib/toybox-feed";
import { DEFAULT_USER_PROFILE } from "@/lib/user-profile";
import { serviceMessages } from "@/messages/service";

const FavoriteTournamentComposerModal = dynamic(
  () => import("@/components/this-or-that/favorite-tournament-composer-modal").then(
    (mod) => mod.FavoriteTournamentComposerModal,
  ),
  { ssr: false },
);

export function FavoriteTournamentClient({
  gameLocale,
  title,
  hero,
  presetLabels,
}: {
  gameLocale: GameLocale;
  title: string;
  hero: string;
  presetLabels: Record<string, string>;
}) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].favoriteTournament;
  const { userId, ready, ensureUser } = useAuth();
  const [sort, setSort] = useState<ToyboxFeedSort>(DEFAULT_TOYBOX_FEED_SORT);
  const [composerOpen, setComposerOpen] = useState(false);
  const catalog = useDecisionsDecisionsCatalog(gameLocale);
  const {
    posts,
    likeCounts,
    commentCounts,
    loading,
    loadingMore,
    hasMore,
    unavailable,
    loadMore,
    add,
  } = useFavoriteTournamentPosts(userId, sort);
  const profileFallback = useMemo(
    () => ({ ...DEFAULT_USER_PROFILE, nickname: copy.defaultNickname }),
    [copy.defaultNickname],
  );
  const { profile } = useUserProfile(profileFallback);

  const handleSubmit = useCallback(async (
    values: Omit<SaveFavoriteTournamentInput, "activeUserId">,
  ) => {
    const activeUserId = userId ?? await ensureUser();
    if (!activeUserId) return false;
    const post = await add({ ...values, activeUserId });
    if (post) setComposerOpen(false);
    return Boolean(post);
  }, [add, ensureUser, userId]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-4">
          <Image
            src={FAVORITE_TOURNAMENT_TOKEN_SRC}
            alt={title}
            width={56}
            height={56}
            className="h-14 w-14 shrink-0 object-contain drop-shadow"
          />
          <div className="min-w-0">
            <h1 className="text-3xl font-black tracking-tight text-zinc-50">
              {title}
            </h1>
          </div>
          {ready && !unavailable && (
            <button
              type="button"
              aria-expanded={composerOpen}
              onClick={() => setComposerOpen(true)}
              className="group/create ml-auto inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 text-xs font-semibold text-primary shadow-[0_0_18px_rgba(239,200,81,0.06)] transition-[transform,border-color,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/15 hover:shadow-[0_6px_22px_rgba(239,200,81,0.1)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary/70 active:translate-y-0 motion-reduce:transform-none"
            >
              <Image
                src={FAVORITE_TOURNAMENT_TOKEN_SRC}
                alt=""
                width={18}
                height={18}
                className="object-contain transition-transform duration-200 group-hover/create:rotate-12 motion-reduce:transform-none"
              />
              {copy.create}
            </button>
          )}
        </div>
        <ToyBoxIndexHeading subtitle={copy.subtitle} hero={hero} />
        <ThisOrThatServiceTabs
          active="worldcup"
          serviceLocale={serviceLocale}
          gameLocale={gameLocale}
        />
      </header>

      {composerOpen && ready && (
        catalog.error ? (
          <p className="text-sm text-muted-foreground">{copy.resourcesMissing}</p>
        ) : (
          <FavoriteTournamentComposerModal
            entities={catalog.entities}
            entityMap={catalog.entityMap}
            stamps={catalog.stamps}
            gameLocale={gameLocale}
            serviceLocale={serviceLocale}
            presetLabels={presetLabels}
            submitLabel={copy.submit}
            profileNickname={profile.nickname}
            onSubmit={handleSubmit}
            onClose={() => setComposerOpen(false)}
          />
        )
      )}

      {!loading && !unavailable && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FeedSortToggle
            service="favorite_tournament"
            sort={sort}
            onSortChange={setSort}
            labels={serviceMessages[serviceLocale].feedSort}
          />
          <span className="text-xs text-muted-foreground">
            {copy.count.replace("{count}", String(posts.length))}
          </span>
        </div>
      )}

      {unavailable ? (
        <StorageUnavailableNotice title={copy.unavailableTitle} />
      ) : loading || catalog.loading ? (
        <ContentLoadingNotice label={copy.loading} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {posts.length === 0 && (
            <p className="text-sm text-muted-foreground">{copy.empty}</p>
          )}
          {posts.map((post) => (
            <FavoriteTournamentPostCard
              key={post.id}
              post={post}
              entityMap={catalog.entityMap}
              isOwner={Boolean(userId && post.user_id === userId)}
              serviceLocale={serviceLocale}
              gameLocale={gameLocale}
              userId={userId}
              authReady={ready}
              ensureUser={ensureUser}
              commentCount={commentCounts[post.id] ?? 0}
              likeCount={likeCounts[post.id] ?? 0}
            />
          ))}
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
