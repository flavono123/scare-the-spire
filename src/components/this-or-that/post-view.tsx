"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CommentSection } from "@/components/comment-section";
import { ContentLoadingNotice } from "@/components/content-loading-notice";
import { StorageUnavailableNotice } from "@/components/storage-unavailable-notice";
import { useAuth } from "@/hooks/use-auth";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { useThisOrThatEntities } from "@/hooks/use-this-or-that-entities";
import { useThisOrThatLikes } from "@/hooks/use-this-or-that-likes";
import { useThisOrThatPost } from "@/hooks/use-this-or-that-posts";
import type { GameLocale } from "@/lib/i18n";
import { localizeHrefWithGameLocale } from "@/lib/i18n";
import {
  buildThisOrThatEntityMap,
  resolveThisOrThatPost,
} from "@/lib/this-or-that";
import { serviceMessages } from "@/messages/service";
import { ThisOrThatLikeButton } from "@/components/this-or-that/like-button";
import { ThisOrThatResourcePanel } from "@/components/this-or-that/resource-panel";

export function ThisOrThatPostView({
  postId,
  gameLocale,
  title,
}: {
  postId: string;
  gameLocale: GameLocale;
  title: string;
}) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].thisOrThat;
  const { userId, ready: authReady, unavailable: authUnavailable, ensureUser } = useAuth();
  const { post, loading, unavailable } = useThisOrThatPost(postId);
  const {
    entities,
    loading: resourcesLoading,
  } = useThisOrThatEntities(gameLocale);
  const postIds = useMemo(() => post ? [post.id] : [], [post]);
  const likes = useThisOrThatLikes(postIds, userId);
  const entityMap = useMemo(() => buildThisOrThatEntityMap(entities), [entities]);
  const resolvedPost = useMemo(
    () => (post ? resolveThisOrThatPost(post, entityMap) : null),
    [entityMap, post],
  );
  const handleToggleLike = async () => {
    if (!post) return;
    const activeUserId = userId ?? await ensureUser();
    if (!activeUserId) return;
    await likes.toggle(post.id, activeUserId);
  };

  if (unavailable) {
    return <StorageUnavailableNotice title={copy.unavailableTitle} />;
  }

  if (loading || resourcesLoading) {
    return <ContentLoadingNotice label={copy.loading} />;
  }

  if (!resolvedPost?.leftEntity || !resolvedPost.rightEntity) {
    return (
      <div className="py-12 text-center">
        <p className="mb-4 text-sm text-muted-foreground">{copy.notFound}</p>
        <Link
          href={localizeHrefWithGameLocale("/this-or-that", serviceLocale, gameLocale)}
          className="text-sm text-yellow-400 underline-offset-4 hover:underline"
        >
          {title}
        </Link>
      </div>
    );
  }

  const { leftEntity, rightEntity } = resolvedPost;

  return (
    <div className="space-y-5">
      <Link
        href={localizeHrefWithGameLocale("/this-or-that", serviceLocale, gameLocale)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-yellow-400"
      >
        <ArrowLeft size={16} />
        {title}
      </Link>

      <article className="space-y-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="whitespace-pre-wrap break-words font-game-title text-2xl font-semibold leading-snug spire-gold md:text-3xl">
              {resolvedPost.post.reason}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="truncate">{resolvedPost.post.nickname}</span>
              <span aria-hidden="true">·</span>
              <span>
                {new Date(resolvedPost.post.created_at).toLocaleDateString(serviceLocale === "ko" ? "ko-KR" : "en-US")}
              </span>
            </div>
          </div>
          <ThisOrThatLikeButton
            count={likes.counts[resolvedPost.post.id] ?? 0}
            liked={likes.liked.has(resolvedPost.post.id)}
            loading={likes.loading}
            unavailable={likes.unavailable}
            disabled={!authReady || authUnavailable}
            onToggle={handleToggleLike}
            label={copy.like}
            className="shrink-0"
          />
        </header>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-stretch">
          <ThisOrThatResourcePanel
            entity={leftEntity}
            sideLabel={copy.leftLabel}
            serviceLocale={serviceLocale}
            gameLocale={gameLocale}
            size="large"
            assetOnly
            linkAsset
          />
          <div className="flex items-center justify-center font-game-title text-2xl font-black text-yellow-500/80 md:w-12">
            VS
          </div>
          <ThisOrThatResourcePanel
            entity={rightEntity}
            sideLabel={copy.rightLabel}
            serviceLocale={serviceLocale}
            gameLocale={gameLocale}
            size="large"
            assetOnly
            linkAsset
          />
        </div>
      </article>

      <section className="rounded-lg border border-border bg-card/20 p-4">
        <h2 className="mb-3 font-service text-sm font-semibold text-zinc-300">
          {copy.commentsTitle}
        </h2>
        <CommentSection
          threadKey={`this-or-that:${resolvedPost.post.id}`}
          initialEntities={entities}
        />
      </section>
    </div>
  );
}
