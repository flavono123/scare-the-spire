"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { buildEntityMap } from "@/components/chemicalx/post-renderer";
import { ContentLoadingNotice } from "@/components/content-loading-notice";
import { FeedLoadMoreSentinel } from "@/components/feed-load-more-sentinel";
import { FeedSortToggle } from "@/components/feed-sort-toggle";
import { RichText } from "@/components/rich-text";
import { StorageUnavailableNotice } from "@/components/storage-unavailable-notice";
import Image from "@/components/ui/static-image";
import { useAuth } from "@/hooks/use-auth";
import { useServiceLocale } from "@/hooks/use-service-locale";
import {
  useTransfigurePosts,
  type SaveTransfigurePostInput,
} from "@/hooks/use-transfigure-posts";
import { useUserProfile } from "@/hooks/use-user-profile";
import type { GameLocale } from "@/lib/i18n";
import { DEFAULT_TOYBOX_FEED_SORT, type ToyboxFeedSort } from "@/lib/toybox-feed";
import type { TransfigurePost } from "@/lib/transfigure-types";
import { DEFAULT_USER_PROFILE } from "@/lib/user-profile";
import { serviceMessages } from "@/messages/service";
import { TransfigurePostCard } from "./transfigure-post-card";

const TransfigureComposerModal = dynamic(
  () => import("./transfigure-composer-modal").then(
    (module) => module.TransfigureComposerModal,
  ),
  { ssr: false },
);

interface TransfigureClientProps {
  entities: EntityInfo[];
  gameLocale: GameLocale;
  title: string;
  subtitle: string;
  upgradeLabel: string;
}

export function TransfigureClient({
  entities,
  gameLocale,
  title,
  subtitle,
  upgradeLabel,
}: TransfigureClientProps) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].transfigure;
  const { userId, ready, ensureUser } = useAuth();
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
    update,
    remove,
  } = useTransfigurePosts(userId, sort);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<TransfigurePost | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const profileFallback = useMemo(
    () => ({ ...DEFAULT_USER_PROFILE, nickname: copy.defaultNickname }),
    [copy.defaultNickname],
  );
  const { profile } = useUserProfile(profileFallback);
  const entityMap = useMemo(() => buildEntityMap(entities), [entities]);

  const handleSubmit = useCallback(async (
    input: Omit<SaveTransfigurePostInput, "activeUserId">,
  ) => {
    const activeUserId = userId ?? await ensureUser();
    if (!activeUserId) throw new Error("anonymous auth unavailable");
    const updating = editingPost != null;
    const post = editingPost
      ? await update(editingPost.id, { ...input, activeUserId })
      : await add({ ...input, activeUserId });
    if (!post) throw new Error("transfigure post rejected");
    setComposerOpen(false);
    setEditingPost(null);
    setSaveNotice(updating ? copy.updateSuccess : copy.createSuccess);
  }, [
    add,
    copy.createSuccess,
    copy.updateSuccess,
    editingPost,
    ensureUser,
    update,
    userId,
  ]);
  const closeComposer = useCallback(() => {
    setComposerOpen(false);
    setEditingPost(null);
  }, []);
  const handleComposerDelete = useCallback(async () => {
    if (!editingPost) return;
    const removed = await remove(editingPost.id);
    if (removed) closeComposer();
  }, [closeComposer, editingPost, remove]);

  return (
    <div data-transfigure-page="index" className="space-y-6">
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src="/images/sts2/relics/astrolabe.webp"
              alt={title}
              width={52}
              height={52}
              className="object-contain drop-shadow-[0_0_16px_rgba(239,200,81,0.28)]"
            />
            <h1 className="spire-gold truncate font-service text-xl font-bold">
              {title}
            </h1>
          </div>
          {ready && !unavailable && (
            <button
              type="button"
              aria-expanded={composerOpen}
              onClick={() => {
                setSaveNotice(null);
                setEditingPost(null);
                setComposerOpen(true);
              }}
              className="group/create inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary shadow-[0_0_18px_rgba(239,200,81,0.06)] transition-[transform,border-color,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/15 hover:shadow-[0_6px_22px_rgba(239,200,81,0.1)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary/70 active:translate-y-0 motion-reduce:transform-none"
            >
              <Image
                src="/images/sts2/relics/astrolabe.webp"
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

      {saveNotice && (
        <p
          role="status"
          aria-live="polite"
          className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary"
          data-transfigure-save-feedback="success"
        >
          {saveNotice}
        </p>
      )}

      {composerOpen && ready && !unavailable && (
        <TransfigureComposerModal
          entities={entities}
          gameLocale={gameLocale}
          initialPost={editingPost}
          profileNickname={profile.nickname}
          serviceLocale={serviceLocale}
          upgradeLabel={upgradeLabel}
          onSubmit={handleSubmit}
          onDelete={editingPost ? handleComposerDelete : undefined}
          onClose={closeComposer}
        />
      )}

      {!loading && !unavailable && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FeedSortToggle
            service="transfigure"
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
      ) : loading ? (
        <ContentLoadingNotice label={copy.loading} />
      ) : posts.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-500">{copy.empty}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {posts.map((post) => (
              <TransfigurePostCard
                key={post.id}
                post={post}
                entities={entities}
                entityMap={entityMap}
                isOwner={Boolean(userId && post.user_id === userId)}
                serviceLocale={serviceLocale}
                gameLocale={gameLocale}
                upgradeLabel={upgradeLabel}
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
