"use client";

import { useCallback, useMemo } from "react";
import Image from "@/components/ui/static-image";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { ContentLoadingNotice } from "@/components/content-loading-notice";
import { StorageUnavailableNotice } from "@/components/storage-unavailable-notice";
import { useAuth } from "@/hooks/use-auth";
import { useComboPosts } from "@/hooks/use-combo-posts";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { useUserProfile } from "@/hooks/use-user-profile";
import type { PostBlock } from "@/lib/chemical-types";
import type { GameLocale } from "@/lib/i18n";
import { DEFAULT_USER_PROFILE } from "@/lib/user-profile";
import { serviceMessages } from "@/messages/service";
import { ComboEditor } from "./combo-editor";
import { buildComboEntityMap } from "./combo-post-renderer";
import { ComboPostCard } from "./combo-post-card";

interface ComboClientProps {
  entities: EntityInfo[];
  gameLocale: GameLocale;
  placeholder: string;
}

export function ComboClient({ entities, gameLocale, placeholder }: ComboClientProps) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].combo;
  const { userId, ready, ensureUser } = useAuth();
  const { posts, loading, unavailable, add, remove } = useComboPosts(userId);
  const profileFallback = useMemo(
    () => ({ ...DEFAULT_USER_PROFILE, nickname: copy.defaultNickname }),
    [copy.defaultNickname],
  );
  const { profile } = useUserProfile(profileFallback);
  const entityMap = useMemo(() => buildComboEntityMap(entities), [entities]);

  const handleSubmit = useCallback(async (blocks: PostBlock[], nickname: string) => {
    const activeUserId = userId ?? await ensureUser();
    if (!activeUserId) throw new Error("anonymous auth unavailable");
    const post = await add({ blocks, nickname, activeUserId });
    if (!post) throw new Error("combo post rejected");
  }, [add, ensureUser, userId]);

  return (
    <div data-combo-page="index" className="space-y-6">
      <header className="flex items-center gap-3">
        <Image
          src="/images/sts2/badges/ccccombo.webp"
          alt={copy.title}
          width={48}
          height={48}
          className="object-contain drop-shadow-[0_0_14px_rgba(250,204,21,0.28)]"
        />
        <h1 className="font-service text-xl font-bold text-yellow-400">{copy.title}</h1>
      </header>

      {ready && !unavailable && (
        <ComboEditor
          entities={entities}
          placeholder={placeholder}
          profileNickname={profile.nickname}
          serviceLocale={serviceLocale}
          onSubmit={handleSubmit}
        />
      )}

      {!loading && !unavailable && (
        <span className="text-xs text-gray-500">
          {copy.count.replace("{count}", String(posts.length))}
        </span>
      )}

      {unavailable ? (
        <StorageUnavailableNotice title={copy.unavailableTitle} />
      ) : loading ? (
        <ContentLoadingNotice label={copy.loading} />
      ) : posts.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-500">{copy.empty}</p>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <ComboPostCard
              key={post.id}
              post={post}
              entityMap={entityMap}
              isOwner={post.user_id === userId}
              serviceLocale={serviceLocale}
              gameLocale={gameLocale}
              onDelete={remove}
            />
          ))}
        </div>
      )}
    </div>
  );
}
