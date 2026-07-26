"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
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
import { buildComboEntityMap } from "./combo-post-renderer";
import { ComboPostCard } from "./combo-post-card";

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
  const { posts, loading, unavailable, add, remove } = useComboPosts(userId);
  const [composerOpen, setComposerOpen] = useState(false);
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
    setComposerOpen(false);
  }, [add, ensureUser, userId]);

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
            onClick={() => setComposerOpen(true)}
            className="group/create inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-yellow-400/30 bg-yellow-500/10 px-3 py-2 text-xs font-semibold text-yellow-200 shadow-[0_0_18px_rgba(250,204,21,0.06)] transition-[transform,border-color,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-yellow-300/50 hover:bg-yellow-500/15 hover:shadow-[0_6px_22px_rgba(250,204,21,0.1)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-yellow-400/70 active:translate-y-0 motion-reduce:transform-none"
          >
            <Image
              src="/images/sts2/badges/ccccombo.webp"
              alt=""
              width={18}
              height={18}
              className="object-contain transition-transform duration-200 group-hover/create:scale-110 motion-reduce:transform-none"
            />
            {copy.create}
          </button>
        )}
      </header>

      {composerOpen && ready && !unavailable && (
        <ComboComposerModal
          entities={entities}
          placeholder={placeholder}
          profileNickname={profile.nickname}
          serviceLocale={serviceLocale}
          onSubmit={handleSubmit}
          onClose={() => setComposerOpen(false)}
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
