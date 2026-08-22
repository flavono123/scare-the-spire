"use client";

import { useMemo, useState, useCallback } from "react";
import Image from "@/components/ui/static-image";
import { ContentLoadingNotice } from "@/components/content-loading-notice";
import { FeedLoadMoreSentinel } from "@/components/feed-load-more-sentinel";
import { FeedSortToggle } from "@/components/feed-sort-toggle";
import { StorageUnavailableNotice } from "@/components/storage-unavailable-notice";
import { useAuth } from "@/hooks/use-auth";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { useThisOrThatEntities } from "@/hooks/use-this-or-that-entities";
import { useThisOrThatLikes } from "@/hooks/use-this-or-that-likes";
import { useThisOrThatPosts } from "@/hooks/use-this-or-that-posts";
import { useThisOrThatVotes } from "@/hooks/use-this-or-that-votes";
import { useUserProfile } from "@/hooks/use-user-profile";
import type { GameLocale } from "@/lib/i18n";
import {
  buildThisOrThatEntityMap,
  resolveThisOrThatPost,
  type ThisOrThatResourceRef,
} from "@/lib/this-or-that";
import { DEFAULT_TOYBOX_FEED_SORT, type ToyboxFeedSort } from "@/lib/toybox-feed";
import { DEFAULT_USER_PROFILE } from "@/lib/user-profile";
import { serviceMessages } from "@/messages/service";
import { ThisOrThatComposerModal } from "@/components/this-or-that/composer-modal";
import { ThisOrThatPostCard } from "@/components/this-or-that/post-card";

export function ThisOrThatClient({
  gameLocale,
  title,
  prompt,
  votePrompt,
  voteDone,
}: {
  gameLocale: GameLocale;
  title: string;
  prompt: string;
  votePrompt: string;
  voteDone: string;
}) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].thisOrThat;
  const { userId, ready, unavailable: authUnavailable, ensureUser } = useAuth();
  const [sort, setSort] = useState<ToyboxFeedSort>(DEFAULT_TOYBOX_FEED_SORT);
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
  } = useThisOrThatPosts(userId, sort);
  const {
    entities,
    loading: resourcesLoading,
    error: resourcesError,
  } = useThisOrThatEntities(gameLocale);
  const profileFallback = useMemo(
    () => ({ ...DEFAULT_USER_PROFILE, nickname: copy.defaultNickname }),
    [copy.defaultNickname],
  );
  const { profile } = useUserProfile(profileFallback);
  const entityMap = useMemo(() => buildThisOrThatEntityMap(entities), [entities]);
  const resolvedPosts = useMemo(
    () => posts.map((post) => resolveThisOrThatPost(post, entityMap)),
    [entityMap, posts],
  );
  const postIds = useMemo(() => posts.map((post) => post.id), [posts]);
  const likes = useThisOrThatLikes(postIds, userId, likeCounts);
  const votes = useThisOrThatVotes(postIds, userId, ensureUser);
  const [composerOpen, setComposerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async ({
    left,
    right,
    reason,
  }: {
    left: ThisOrThatResourceRef;
    right: ThisOrThatResourceRef;
    reason: string;
  }) => {
    setSubmitting(true);
    try {
      const activeUserId = userId ?? await ensureUser();
      if (!activeUserId) return false;
      const post = await add({
        left,
        right,
        reason,
        nickname: profile.nickname,
        activeUserId,
      });
      return Boolean(post);
    } finally {
      setSubmitting(false);
    }
  }, [add, ensureUser, profile.nickname, userId]);

  const handleToggleLike = useCallback(
    async (postId: string) => {
      const activeUserId = userId ?? await ensureUser();
      if (!activeUserId) return;
      await likes.toggle(postId, activeUserId);
    },
    [ensureUser, likes, userId],
  );

  const storageUnavailable = authUnavailable || unavailable;
  const contentLoading = loading || resourcesLoading;

  return (
    <div className="space-y-6">
      {composerOpen && (
        <ThisOrThatComposerModal
          entities={entities}
          gameLocale={gameLocale}
          placeholder={prompt || copy.reasonPlaceholder}
          authReady={ready}
          storageUnavailable={storageUnavailable}
          submitting={submitting}
          onSubmit={handleSubmit}
          onClose={() => setComposerOpen(false)}
        />
      )}

      <header className="flex items-center gap-4">
        <Image
          src="/images/sts2/relics/choices_paradox.webp"
          alt={title}
          width={56}
          height={56}
          className="h-14 w-14 shrink-0 object-contain drop-shadow"
        />
        <div className="min-w-0">
          <h1 className="text-3xl font-black tracking-tight text-zinc-50">
            {title}
          </h1>
          {prompt && (
            <p className="mt-1 line-clamp-2 max-w-2xl text-sm leading-6 text-zinc-400">
              {prompt}
            </p>
          )}
        </div>
        {!storageUnavailable && (
          <button
            type="button"
            aria-expanded={composerOpen}
            onClick={() => {
              if (!resourcesLoading && !resourcesError) setComposerOpen(true);
            }}
            className="group/create ml-auto inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-yellow-400/30 bg-yellow-500/10 px-3 text-xs font-semibold text-yellow-200 shadow-[0_0_18px_rgba(250,204,21,0.06)] transition-[transform,border-color,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-yellow-300/50 hover:bg-yellow-500/15 hover:shadow-[0_6px_22px_rgba(250,204,21,0.1)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-yellow-400/70 active:translate-y-0 motion-reduce:transform-none"
          >
            <Image
              src="/images/sts2/relics/choices_paradox.webp"
              alt=""
              width={18}
              height={18}
              className="object-contain transition-transform duration-200 group-hover/create:rotate-12 motion-reduce:transform-none"
            />
            {copy.create}
          </button>
        )}
      </header>

      {storageUnavailable ? (
        <StorageUnavailableNotice title={copy.unavailableTitle} />
      ) : resourcesError ? (
        <p className="text-sm text-muted-foreground">{copy.resourcesMissing}</p>
      ) : null}

      {!storageUnavailable && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FeedSortToggle
            service="this_or_that"
            sort={sort}
            onSortChange={setSort}
            labels={serviceMessages[serviceLocale].feedSort}
          />
          <span className="text-xs text-muted-foreground">
            {copy.count.replace("{count}", String(posts.length))}
          </span>
        </div>
      )}

      {storageUnavailable ? null : contentLoading ? (
        <ContentLoadingNotice label={copy.loading} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {resolvedPosts.map((resolvedPost) => (
            <ThisOrThatPostCard
              key={resolvedPost.post.id}
              resolvedPost={resolvedPost}
              serviceLocale={serviceLocale}
              gameLocale={gameLocale}
              isOwner={Boolean(userId && resolvedPost.post.user_id === userId)}
              likeCount={likes.counts[resolvedPost.post.id] ?? likeCounts[resolvedPost.post.id] ?? 0}
              liked={likes.liked.has(resolvedPost.post.id)}
              likesLoading={likes.loading}
              likesUnavailable={likes.unavailable}
              commentCount={commentCounts[resolvedPost.post.id] ?? 0}
              canLike={ready && !authUnavailable}
              canVote={ready && !authUnavailable && !votes.loading && !votes.unavailable}
              voteSummary={votes.summaries[resolvedPost.post.id]}
              voteChoice={votes.choices[resolvedPost.post.id]}
              votePending={votes.pending.has(resolvedPost.post.id)}
              voteLoading={votes.loading}
              voteUnavailable={votes.unavailable || authUnavailable}
              votePrompt={votePrompt}
              voteDone={voteDone}
              onToggleLike={handleToggleLike}
              onVote={(choice) => votes.vote(resolvedPost.post.id, choice, "index")}
              onRetryVote={() => votes.cancel(resolvedPost.post.id)}
            />
          ))}
          <FeedLoadMoreSentinel
            hasMore={hasMore}
            loadingMore={loadingMore}
            disabled={storageUnavailable}
            extraKey={posts.length}
            label={copy.loadingMore}
            onLoadMore={() => { void loadMore(); }}
          />
        </div>
      )}
    </div>
  );
}
