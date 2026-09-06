"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LayoutGrid, List } from "lucide-react";
import { ContentLoadingNotice } from "@/components/content-loading-notice";
import { GAME_UI_HOVER_TIP_NAV_DELAY_MS, GameUiHoverTip } from "@/components/game-ui-hover-tip";
import { OwnPostMark } from "@/components/own-post-mark";
import { DisplayedProfileNickname } from "@/components/profile/displayed-profile-nickname";
import { StorageUnavailableNotice } from "@/components/storage-unavailable-notice";
import Image from "@/components/ui/static-image";
import { ToyBoxIndexHeading } from "@/components/toybox-index-heading";
import { useAuth } from "@/hooks/use-auth";
import { useGameLocale } from "@/hooks/use-game-locale";
import { insertPagestormPost, usePagestormPosts } from "@/hooks/use-pagestorm-posts";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { useUserProfile } from "@/hooks/use-user-profile";
import type { PagestormGameCopy } from "@/lib/borrowed-game-copy";
import { localizeHrefWithGameLocale } from "@/lib/i18n";
import {
  PAGESTORM_BETA_ART_SRC,
  PAGESTORM_HREF,
  PAGESTORM_TOKEN_SRC,
  PAGESTORM_WRITE_HREF,
  pagestormDetailHref,
  pagestormSnippet,
  type PagestormPostCard,
} from "@/lib/pagestorm";
import { DEFAULT_USER_PROFILE } from "@/lib/user-profile";
import { cn } from "@/lib/utils";
import { serviceMessages } from "@/messages/service";
import type { PagestormEditorSaveInput } from "./pagestorm-editor";

function EditorLoading() {
  const serviceLocale = useServiceLocale();
  return (
    <p className="p-4 text-sm text-muted-foreground">
      {serviceMessages[serviceLocale].pagestorm.editorLoading}
    </p>
  );
}

const Editor = dynamic(
  () => import("./pagestorm-editor").then((mod) => mod.PagestormEditor),
  {
    ssr: false,
    loading: EditorLoading,
  },
);

type PagestormIndexView = "gallery" | "list";

function PagestormIndexThumb({
  imageUrl,
  kind,
  view,
}: {
  imageUrl: string | null;
  kind: string | null;
  view: PagestormIndexView;
}) {
  const src = imageUrl ?? PAGESTORM_BETA_ART_SRC;
  const cardArt = kind === "card" || !imageUrl;
  return (
    <div
      className={cn(
        "overflow-hidden bg-black/25",
        view === "gallery" ? "aspect-[16/10] w-full rounded-t-lg" : "h-[4.5rem] w-20 shrink-0 rounded-md",
      )}
    >
      <Image
        src={src}
        alt=""
        width={cardArt ? 150 : 320}
        height={cardArt ? 211 : 160}
        className="h-full w-full object-contain"
      />
    </div>
  );
}

function PagestormIndexCard({
  href,
  view,
  nickname,
  isOwner,
  title,
  snippet,
  thumbnailUrl,
  thumbnailKind,
  postKey,
}: {
  href: string;
  view: PagestormIndexView;
  nickname: string;
  isOwner: boolean;
  title: string;
  snippet: string;
  thumbnailUrl: string | null;
  thumbnailKind: string | null;
  postKey: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-lg border border-border bg-card/30 transition-colors hover:border-primary/20 focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary/70",
        view === "list" ? "px-4 py-3" : "overflow-hidden",
      )}
    >
      <article
        data-pagestorm-post={postKey}
        className={view === "list" ? undefined : "flex h-full flex-col"}
      >
        {view === "gallery" ? (
          <PagestormIndexThumb
            imageUrl={thumbnailUrl}
            kind={thumbnailKind}
            view={view}
          />
        ) : null}
        <div className={cn(view === "gallery" ? "px-3 py-3" : "flex items-start gap-3")}>
          {view === "list" ? (
            <PagestormIndexThumb
              imageUrl={thumbnailUrl}
              kind={thumbnailKind}
              view={view}
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <DisplayedProfileNickname
                  nickname={nickname}
                  isOwner={isOwner}
                  size={18}
                  tokenClassName="h-[18px] w-[18px]"
                  nicknameClassName="truncate text-sm font-semibold text-gray-300"
                />
                {isOwner ? <OwnPostMark /> : null}
              </span>
            </div>
            <h2 className="font-game-title text-base text-foreground">
              {title}
            </h2>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {snippet}
            </p>
          </div>
        </div>
      </article>
    </Link>
  );
}

export function PagestormClient({ gameCopy }: { gameCopy: PagestormGameCopy }) {
  const serviceLocale = useServiceLocale();
  const gameLocale = useGameLocale();
  const copy = serviceMessages[serviceLocale].pagestorm;
  const { userId } = useAuth();
  const { posts, loading, unavailable } = usePagestormPosts();
  const [view, setView] = useState<PagestormIndexView>("gallery");
  const writeHref = localizeHrefWithGameLocale(
    PAGESTORM_WRITE_HREF,
    serviceLocale,
    gameLocale,
  );
  const count = posts.length;

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src={PAGESTORM_TOKEN_SRC}
              alt={gameCopy.title}
              width={32}
              height={32}
              className="object-contain"
            />
            <h1 className="truncate font-service text-xl font-bold text-primary">
              {gameCopy.title}
            </h1>
          </div>
          <Link
            href={writeHref}
            className="group/create inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary shadow-[0_0_18px_rgba(239,200,81,0.06)] transition-[transform,border-color,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/15 hover:shadow-[0_6px_22px_rgba(239,200,81,0.1)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary/70 active:translate-y-0 motion-reduce:transform-none"
          >
            <Image
              src={PAGESTORM_TOKEN_SRC}
              alt=""
              width={18}
              height={18}
              className="object-contain transition-transform duration-200 group-hover/create:rotate-12 motion-reduce:transform-none"
            />
            {copy.create}
          </Link>
        </div>
        <ToyBoxIndexHeading
          subtitle={copy.subtitle}
          hero={gameCopy.hero}
          heroRich
        />
      </header>
      {unavailable ? (
        <StorageUnavailableNotice title={copy.unavailableTitle} />
      ) : null}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            {copy.count.replace("{count}", String(count))}
          </p>
          <div
            className="inline-flex overflow-hidden rounded-md border border-border/70 bg-background/40"
            role="group"
            aria-label={`${copy.viewGallery} / ${copy.viewList}`}
            data-pagestorm-index-view={view}
          >
            <GameUiHoverTip label={copy.viewGallery} delayMs={GAME_UI_HOVER_TIP_NAV_DELAY_MS}>
              <button
                type="button"
                aria-pressed={view === "gallery"}
                aria-label={copy.viewGallery}
                className={cn(
                  "inline-flex h-8 w-8 items-center justify-center",
                  view === "gallery"
                    ? "bg-white/10 text-foreground"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                )}
                onClick={() => setView("gallery")}
              >
                <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
              </button>
            </GameUiHoverTip>
            <GameUiHoverTip label={copy.viewList} delayMs={GAME_UI_HOVER_TIP_NAV_DELAY_MS}>
              <button
                type="button"
                aria-pressed={view === "list"}
                aria-label={copy.viewList}
                className={cn(
                  "inline-flex h-8 w-8 items-center justify-center",
                  view === "list"
                    ? "bg-white/10 text-foreground"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                )}
                onClick={() => setView("list")}
              >
                <List className="h-3.5 w-3.5" aria-hidden />
              </button>
            </GameUiHoverTip>
          </div>
        </div>
        <div
          className={
            view === "gallery"
              ? "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
              : "space-y-3"
          }
        >
          {unavailable ? null : loading ? (
            <div className={view === "gallery" ? "col-span-full" : undefined}>
              <ContentLoadingNotice label={copy.loading} />
            </div>
          ) : posts.map((post: PagestormPostCard) => (
            <PagestormIndexCard
              key={post.id}
              href={localizeHrefWithGameLocale(
                pagestormDetailHref(post.id),
                serviceLocale,
                gameLocale,
              )}
              view={view}
              nickname={post.nickname}
              isOwner={Boolean(userId && post.user_id === userId)}
              title={post.title}
              snippet={pagestormSnippet(post.content_text)}
              thumbnailUrl={post.thumbnailUrl}
              thumbnailKind={post.thumbnailKind}
              postKey={post.id}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function PagestormWriteClient({ gameCopy }: { gameCopy: PagestormGameCopy }) {
  const serviceLocale = useServiceLocale();
  const gameLocale = useGameLocale();
  const copy = serviceMessages[serviceLocale].pagestorm;
  const router = useRouter();
  const { userId, ensureUser } = useAuth();
  const profileFallback = {
    ...DEFAULT_USER_PROFILE,
    nickname: copy.defaultNickname,
  };
  const { profile } = useUserProfile(profileFallback);
  const indexHref = localizeHrefWithGameLocale(
    PAGESTORM_HREF,
    serviceLocale,
    gameLocale,
  );
  const [title, setTitle] = useState("");
  const [nickname, setNickname] = useState(profile.nickname);
  const [submitting, setSubmitting] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const handleRegister = useCallback(async (input: PagestormEditorSaveInput) => {
    setSubmitting(true);
    try {
      const activeUserId = userId ?? await ensureUser();
      if (!activeUserId) {
        setUnavailable(true);
        return;
      }
      const post = await insertPagestormPost({
        ...input,
        activeUserId,
      });
      if (!post) {
        setUnavailable(true);
        return;
      }
      router.push(localizeHrefWithGameLocale(
        pagestormDetailHref(post.id),
        serviceLocale,
        gameLocale,
      ));
    } catch {
      setUnavailable(true);
    } finally {
      setSubmitting(false);
    }
  }, [ensureUser, gameLocale, router, serviceLocale, userId]);

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={indexHref}
            className="inline-flex min-w-0 items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-primary"
          >
            <ArrowLeft size={16} />
            {copy.backToIndex}
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <Image
            src={PAGESTORM_TOKEN_SRC}
            alt={gameCopy.title}
            width={32}
            height={32}
            className="object-contain"
          />
          <h1 className="font-service text-xl font-bold text-primary">{gameCopy.title}</h1>
        </div>
      </header>
      {unavailable ? (
        <StorageUnavailableNotice title={copy.unavailableTitle} />
      ) : null}
      <Editor
        mode="edit"
        title={title}
        onTitleChange={setTitle}
        nickname={nickname}
        onNicknameChange={setNickname}
        submitLabel={copy.submit}
        submitting={submitting}
        onSubmit={handleRegister}
      />
    </div>
  );
}
