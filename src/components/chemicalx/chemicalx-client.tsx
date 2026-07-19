"use client";

import { useState, useMemo, useCallback } from "react";
import Image from "@/components/ui/static-image";
import { Eye, EyeOff } from "lucide-react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import type { PostBlock } from "@/lib/chemical-types";
import { ContentLoadingNotice } from "@/components/content-loading-notice";
import { useAuth } from "@/hooks/use-auth";
import { useChemicalPosts } from "@/hooks/use-chemical-posts";
import { useUserProfile } from "@/hooks/use-user-profile";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { DEFAULT_USER_PROFILE } from "@/lib/user-profile";
import { serviceMessages } from "@/messages/service";
import { StorageUnavailableNotice } from "@/components/storage-unavailable-notice";
import { ChemicalXEditor } from "./chemicalx-editor";
import { PostCard } from "./post-card";
import { buildEntityMap } from "./post-renderer";

interface ChemicalXClientProps {
  entities: EntityInfo[];
  placeholder: string;
}

export function ChemicalXClient({ entities, placeholder }: ChemicalXClientProps) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].chemicalX;
  const { userId, ready, ensureUser } = useAuth();
  const { posts, loading, unavailable, add, remove } = useChemicalPosts(userId);
  const [showAllTooltips, setShowAllTooltips] = useState(false);
  const profileFallback = useMemo(
    () => ({ ...DEFAULT_USER_PROFILE, nickname: copy.defaultNickname }),
    [copy.defaultNickname],
  );
  const { profile } = useUserProfile(profileFallback);
  const storageUnavailable = unavailable;

  const entityMap = useMemo(() => buildEntityMap(entities), [entities]);

  const handleSubmit = useCallback(
    async (blocks: PostBlock[], nickname: string) => {
      const activeUserId = userId ?? await ensureUser();
      if (!activeUserId) return;
      await add(blocks, nickname, activeUserId);
    },
    [add, ensureUser, userId],
  );

  const handleDelete = useCallback(
    (postId: string) => {
      remove(postId);
    },
    [remove],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-xl border border-yellow-500/15 px-4 py-4 shadow-[0_12px_34px_rgba(0,0,0,0.28)]">
        <Image
          src="/images/sts2/events/amalgamator.webp"
          alt=""
          fill
          sizes="(max-width: 672px) 100vw, 640px"
          className="object-cover object-center opacity-35"
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#080810]/95 via-[#0b0b16]/75 to-[#160d08]/55" />
        <div className="relative flex items-center gap-3">
          <Image
            src="/images/sts2/badges/ccccombo.webp"
            alt={copy.title}
            width={48}
            height={48}
            className="object-contain drop-shadow-[0_0_14px_rgba(250,204,21,0.28)]"
          />
          <div>
            <h1 className="font-service text-xl font-bold text-yellow-400">{copy.title}</h1>
            <span className="text-xs text-zinc-400">{copy.legacyName}</span>
          </div>
        </div>
      </div>

      {/* Editor */}
      {ready && !storageUnavailable && (
        <ChemicalXEditor
          entities={entities}
          placeholder={placeholder}
          profileNickname={profile.nickname}
          onSubmit={handleSubmit}
        />
      )}

      {/* Toolbar */}
      {!loading && !storageUnavailable && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {copy.count.replace("{count}", String(posts.length))}
          </span>
          <button
            type="button"
            onClick={() => setShowAllTooltips((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-yellow-400 transition-colors"
            title={showAllTooltips ? copy.hideTooltips : copy.showAllTooltipsTitle}
          >
            {showAllTooltips ? <EyeOff size={14} /> : <Eye size={14} />}
            {showAllTooltips ? copy.hideTooltips : copy.showAllTooltips}
          </button>
        </div>
      )}

      {/* Feed */}
      {storageUnavailable ? (
        <StorageUnavailableNotice
          title={copy.unavailableTitle}
        />
      ) : loading ? (
        <ContentLoadingNotice label={copy.loading} />
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              entityMap={entityMap}
              forceShowTooltips={showAllTooltips}
              isOwner={post.user_id === userId}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
