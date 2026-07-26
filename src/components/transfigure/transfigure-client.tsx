"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Sparkles } from "lucide-react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { buildEntityMap } from "@/components/chemicalx/post-renderer";
import { ContentLoadingNotice } from "@/components/content-loading-notice";
import { RichText } from "@/components/rich-text";
import { StorageUnavailableNotice } from "@/components/storage-unavailable-notice";
import Image from "@/components/ui/static-image";
import { useAuth } from "@/hooks/use-auth";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { useTransfigurePosts } from "@/hooks/use-transfigure-posts";
import { useUserProfile } from "@/hooks/use-user-profile";
import type { PostBlock } from "@/lib/chemical-types";
import type { GameLocale } from "@/lib/i18n";
import type { TransfigureResourceRef } from "@/lib/transfigure-types";
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
}

export function TransfigureClient({
  entities,
  gameLocale,
  title,
  subtitle,
}: TransfigureClientProps) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].transfigure;
  const { userId, ready, ensureUser } = useAuth();
  const { posts, loading, unavailable, add, remove } = useTransfigurePosts(userId);
  const [composerOpen, setComposerOpen] = useState(false);
  const profileFallback = useMemo(
    () => ({ ...DEFAULT_USER_PROFILE, nickname: copy.defaultNickname }),
    [copy.defaultNickname],
  );
  const { profile } = useUserProfile(profileFallback);
  const entityMap = useMemo(() => buildEntityMap(entities), [entities]);

  const handleSubmit = useCallback(async (
    postTitle: string,
    blocks: PostBlock[],
    nickname: string,
    resource: TransfigureResourceRef,
    sourceText: string,
    sourceBlocks: PostBlock[],
  ) => {
    const activeUserId = userId ?? await ensureUser();
    if (!activeUserId) throw new Error("anonymous auth unavailable");
    const post = await add({
      blocks,
      nickname,
      title: postTitle,
      resource,
      sourceText,
      sourceBlocks,
      sourceGameLocale: gameLocale,
      activeUserId,
    });
    if (!post) throw new Error("transfigure post rejected");
    setComposerOpen(false);
  }, [add, ensureUser, gameLocale, userId]);

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
              onClick={() => setComposerOpen(true)}
              className="group/create inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-yellow-300/30 bg-yellow-500/10 px-3 py-2 text-xs font-semibold text-yellow-100 shadow-[0_0_18px_rgba(239,200,81,0.06)] transition-[transform,border-color,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-yellow-200/50 hover:bg-yellow-500/15 hover:shadow-[0_6px_22px_rgba(239,200,81,0.1)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-yellow-300/70 active:translate-y-0 motion-reduce:transform-none"
            >
              <Sparkles
                className="h-4 w-4 transition-transform duration-200 group-hover/create:rotate-12 group-hover/create:scale-110 motion-reduce:transform-none"
                aria-hidden="true"
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
        <TransfigureComposerModal
          entities={entities}
          gameLocale={gameLocale}
          profileNickname={profile.nickname}
          serviceLocale={serviceLocale}
          onSubmit={handleSubmit}
          onClose={() => setComposerOpen(false)}
        />
      )}

      {!loading && !unavailable && (
        <span className="block text-xs text-gray-500">
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
            <TransfigurePostCard
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
