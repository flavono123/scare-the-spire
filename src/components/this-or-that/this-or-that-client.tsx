"use client";

import { useMemo, useState, useCallback } from "react";
import Image from "@/components/ui/static-image";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { ContentLoadingNotice } from "@/components/content-loading-notice";
import { StorageUnavailableNotice } from "@/components/storage-unavailable-notice";
import { useAuth } from "@/hooks/use-auth";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { useThisOrThatCommentCounts } from "@/hooks/use-this-or-that-comment-counts";
import { useThisOrThatLikes } from "@/hooks/use-this-or-that-likes";
import { useThisOrThatPosts } from "@/hooks/use-this-or-that-posts";
import { useUserProfile } from "@/hooks/use-user-profile";
import type { GameLocale } from "@/lib/i18n";
import {
  buildThisOrThatEntityMap,
  resolveThisOrThatPost,
  type ThisOrThatResourceRef,
} from "@/lib/this-or-that";
import { DEFAULT_USER_PROFILE } from "@/lib/user-profile";
import { serviceMessages } from "@/messages/service";
import { StoryWriteIcon } from "@/components/story-token-icon";
import { ThisOrThatComposerModal } from "@/components/this-or-that/composer-modal";
import { ThisOrThatPostCard } from "@/components/this-or-that/post-card";

export function ThisOrThatClient({
  entities,
  gameLocale,
  title,
  prompt,
}: {
  entities: EntityInfo[];
  gameLocale: GameLocale;
  title: string;
  prompt: string;
}) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].thisOrThat;
  const { userId, ready, unavailable: authUnavailable, ensureUser } = useAuth();
  const { posts, loading, unavailable, add, remove } = useThisOrThatPosts(userId);
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
  const likes = useThisOrThatLikes(postIds, userId);
  const comments = useThisOrThatCommentCounts(postIds);
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

  const handleDelete = useCallback(
    (postId: string) => {
      remove(postId);
    },
    [remove],
  );

  const handleToggleLike = useCallback(
    async (postId: string) => {
      const activeUserId = userId ?? await ensureUser();
      if (!activeUserId) return;
      await likes.toggle(postId, activeUserId);
    },
    [ensureUser, likes, userId],
  );

  const storageUnavailable = authUnavailable || unavailable;

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
            onClick={() => setComposerOpen(true)}
            className="ml-auto inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 text-xs font-semibold text-yellow-300 transition-colors hover:bg-yellow-500/20"
          >
            <StoryWriteIcon size={15} />
            {copy.create}
          </button>
        )}
      </header>

      {storageUnavailable ? (
        <StorageUnavailableNotice title={copy.unavailableTitle} />
      ) : null}

      {!storageUnavailable && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {copy.count.replace("{count}", String(posts.length))}
          </span>
        </div>
      )}

      {storageUnavailable ? null : loading ? (
        <ContentLoadingNotice label={copy.loading} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {resolvedPosts.map((resolvedPost) => (
            <ThisOrThatPostCard
              key={resolvedPost.post.id}
              resolvedPost={resolvedPost}
              serviceLocale={serviceLocale}
              gameLocale={gameLocale}
              isOwner={resolvedPost.post.user_id === userId}
              likeCount={likes.counts[resolvedPost.post.id] ?? 0}
              liked={likes.liked.has(resolvedPost.post.id)}
              likesLoading={likes.loading}
              likesUnavailable={likes.unavailable}
              commentCount={comments.counts[resolvedPost.post.id] ?? 0}
              canLike={ready && !authUnavailable}
              onDelete={handleDelete}
              onToggleLike={handleToggleLike}
            />
          ))}
        </div>
      )}
    </div>
  );
}
