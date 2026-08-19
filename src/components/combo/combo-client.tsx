"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Image from "@/components/ui/static-image";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { ContentLoadingNotice } from "@/components/content-loading-notice";
import { FeedLoadMoreSentinel } from "@/components/feed-load-more-sentinel";
import { FeedSortToggle } from "@/components/feed-sort-toggle";
import { StorageUnavailableNotice } from "@/components/storage-unavailable-notice";
import { useAuth } from "@/hooks/use-auth";
import { useComboPosts } from "@/hooks/use-combo-posts";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { useUserProfile } from "@/hooks/use-user-profile";
import type { PostBlock } from "@/lib/chemical-types";
import {
  comboPostMatchesAnyGameElement,
  type ComboPost,
  type ComboResourceRef,
} from "@/lib/combo-types";
import type { GameLocale } from "@/lib/i18n";
import { DEFAULT_TOYBOX_FEED_SORT, type ToyboxFeedSort } from "@/lib/toybox-feed";
import { DEFAULT_USER_PROFILE } from "@/lib/user-profile";
import { serviceMessages } from "@/messages/service";
import { buildComboEntityMap } from "./combo-post-renderer";
import { ComboPostCard } from "./combo-post-card";
import { ComboGameElementFilter } from "./combo-game-element-filter";

const ComboComposerModal = dynamic(
  () => import("./combo-composer-modal").then((module) => module.ComboComposerModal),
  { ssr: false },
);

interface ComboClientProps {
  entities: EntityInfo[];
  gameLocale: GameLocale;
  placeholder: string;
}

export function ComboClient({ entities, gameLocale, placeholder }: ComboClientProps) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].combo;
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
  } = useComboPosts(userId, sort);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<ComboPost | null>(null);
  const [selectedGameElements, setSelectedGameElements] = useState<ComboResourceRef[]>([]);
  const profileFallback = useMemo(
    () => ({ ...DEFAULT_USER_PROFILE, nickname: copy.defaultNickname }),
    [copy.defaultNickname],
  );
  const { profile } = useUserProfile(profileFallback);
  const entityMap = useMemo(() => buildComboEntityMap(entities), [entities]);
  const filteredPosts = useMemo(
    () => posts.filter((post) => (
      comboPostMatchesAnyGameElement(post, selectedGameElements)
    )),
    [posts, selectedGameElements],
  );

  const handleSubmit = useCallback(async (blocks: PostBlock[], nickname: string) => {
    const activeUserId = userId ?? await ensureUser();
    if (!activeUserId) throw new Error("anonymous auth unavailable");
    const post = editingPost
      ? await update(editingPost.id, { blocks, nickname, activeUserId })
      : await add({ blocks, nickname, activeUserId });
    if (!post) throw new Error("combo post rejected");
    setComposerOpen(false);
    setEditingPost(null);
  }, [add, editingPost, ensureUser, update, userId]);
  const closeComposer = useCallback(() => {
    setComposerOpen(false);
    setEditingPost(null);
  }, []);

  return (
    <div data-combo-page="index" className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Image
            src="/images/sts2/badges/ccccombo.webp"
            alt={copy.title}
            width={48}
            height={48}
            className="object-contain drop-shadow-[0_0_14px_rgba(250,204,21,0.28)]"
          />
          <h1 className="truncate font-service text-xl font-bold text-yellow-400">
            {copy.title}
          </h1>
        </div>
        {ready && !unavailable && (
          <button
            type="button"
            aria-expanded={composerOpen}
            onClick={() => {
              setEditingPost(null);
              setComposerOpen(true);
            }}
            className="group/create inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-yellow-400/30 bg-yellow-500/10 px-3 py-2 text-xs font-semibold text-yellow-200 shadow-[0_0_18px_rgba(250,204,21,0.06)] transition-[transform,border-color,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-yellow-300/50 hover:bg-yellow-500/15 hover:shadow-[0_6px_22px_rgba(250,204,21,0.1)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-yellow-400/70 active:translate-y-0 motion-reduce:transform-none"
          >
            <Image
              src="/images/sts2/badges/ccccombo.webp"
              alt=""
              width={18}
              height={18}
              className="object-contain transition-transform duration-200 group-hover/create:rotate-12 motion-reduce:transform-none"
            />
            {copy.create}
          </button>
        )}
      </header>

      {composerOpen && ready && !unavailable && (
        <ComboComposerModal
          entities={entities}
          initialPost={editingPost}
          placeholder={placeholder}
          profileNickname={editingPost?.nickname ?? profile.nickname}
          serviceLocale={serviceLocale}
          onSubmit={handleSubmit}
          onClose={closeComposer}
        />
      )}

      {!loading && !unavailable && (
        <div className="space-y-3">
          <FeedSortToggle
            sort={sort}
            onSortChange={setSort}
            labels={serviceMessages[serviceLocale].feedSort}
          />
          <ComboGameElementFilter
            entities={entities}
            posts={posts}
            selected={selectedGameElements}
            serviceLocale={serviceLocale}
            onSelectedChange={setSelectedGameElements}
          />
          <span className="block text-xs text-gray-500">
            {copy.count.replace("{count}", String(filteredPosts.length))}
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
        <div className="space-y-3">
          {filteredPosts.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">{copy.noMatchingCombos}</p>
          ) : (
            filteredPosts.map((post) => (
                <ComboPostCard
                  key={post.id}
                  post={post}
                  entityMap={entityMap}
                  isOwner={Boolean(userId && post.user_id === userId)}
                  serviceLocale={serviceLocale}
                  gameLocale={gameLocale}
                  userId={userId}
                  authReady={ready}
                  ensureUser={ensureUser}
                  commentCount={commentCounts[post.id] ?? 0}
                  likeCount={likeCounts[post.id] ?? 0}
                />
            ))
          )}
          {hasMore && (
            <FeedLoadMoreSentinel
              hasMore={hasMore}
              loadingMore={loadingMore}
              disabled={unavailable}
              extraKey={filteredPosts.length}
              label={copy.loadingMore}
              onLoadMore={() => { void loadMore(); }}
            />
          )}
        </div>
      )}
    </div>
  );
}
