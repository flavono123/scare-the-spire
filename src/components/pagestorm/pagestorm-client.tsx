"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ContentLoadingNotice } from "@/components/content-loading-notice";
import { OwnPostMark } from "@/components/own-post-mark";
import { DisplayedProfileNickname } from "@/components/profile/displayed-profile-nickname";
import { PostDetailActions } from "@/components/post-detail-actions";
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
  PAGESTORM_HREF,
  PAGESTORM_LOREM_HREF,
  PAGESTORM_LOREM_SNIPPET,
  PAGESTORM_TOKEN_SRC,
  PAGESTORM_WRITE_HREF,
  pagestormDetailHref,
  pagestormSnippet,
} from "@/lib/pagestorm";
import { DEFAULT_USER_PROFILE } from "@/lib/user-profile";
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

export function PagestormClient({ gameCopy }: { gameCopy: PagestormGameCopy }) {
  const serviceLocale = useServiceLocale();
  const gameLocale = useGameLocale();
  const copy = serviceMessages[serviceLocale].pagestorm;
  const { userId } = useAuth();
  const { posts, loading, unavailable } = usePagestormPosts();
  const writeHref = localizeHrefWithGameLocale(
    PAGESTORM_WRITE_HREF,
    serviceLocale,
    gameLocale,
  );
  const loremHref = localizeHrefWithGameLocale(
    PAGESTORM_LOREM_HREF,
    serviceLocale,
    gameLocale,
  );
  const count = 1 + posts.length;

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
        <p className="text-xs text-gray-500">
          {copy.count.replace("{count}", String(count))}
        </p>
        <Link
          href={loremHref}
          className="block rounded-lg border border-border bg-card/30 px-4 py-3 transition-colors hover:border-primary/20 focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary/70"
        >
          <article data-pagestorm-post="lorem">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <DisplayedProfileNickname
                  nickname={copy.defaultNickname}
                  isOwner
                  size={18}
                  tokenClassName="h-[18px] w-[18px]"
                  nicknameClassName="truncate text-sm font-semibold text-gray-300"
                />
                <OwnPostMark />
              </span>
            </div>
            <h2 className="font-game-title text-base text-foreground">
              {copy.sampleHeading}
            </h2>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {PAGESTORM_LOREM_SNIPPET}
            </p>
          </article>
        </Link>
        {unavailable ? null : loading ? (
          <ContentLoadingNotice label={copy.loading} />
        ) : posts.map((post) => {
            const href = localizeHrefWithGameLocale(
              pagestormDetailHref(post.id),
              serviceLocale,
              gameLocale,
            );
            const isOwner = Boolean(userId && post.user_id === userId);
            return (
              <Link
                key={post.id}
                href={href}
                className="block rounded-lg border border-border bg-card/30 px-4 py-3 transition-colors hover:border-primary/20 focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary/70"
              >
                <article data-pagestorm-post={post.id}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <DisplayedProfileNickname
                        nickname={post.nickname}
                        isOwner={isOwner}
                        size={18}
                        tokenClassName="h-[18px] w-[18px]"
                        nicknameClassName="truncate text-sm font-semibold text-gray-300"
                      />
                      {isOwner ? <OwnPostMark /> : null}
                    </span>
                  </div>
                  <h2 className="font-game-title text-base text-foreground">
                    {post.title}
                  </h2>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {pagestormSnippet(post.content_text)}
                  </p>
                </article>
              </Link>
            );
          })}
      </div>
    </div>
  );
}

function PagestormDocumentClient({
  gameCopy,
  surface,
}: {
  gameCopy: PagestormGameCopy;
  surface: "write" | "lorem";
}) {
  const serviceLocale = useServiceLocale();
  const gameLocale = useGameLocale();
  const copy = serviceMessages[serviceLocale].pagestorm;
  const router = useRouter();
  const { userId, ensureUser } = useAuth();
  const profileFallback = useMemo(
    () => ({ ...DEFAULT_USER_PROFILE, nickname: copy.defaultNickname }),
    [copy.defaultNickname],
  );
  const { profile } = useUserProfile(profileFallback);
  const indexHref = localizeHrefWithGameLocale(
    PAGESTORM_HREF,
    serviceLocale,
    gameLocale,
  );
  const [editing, setEditing] = useState(surface === "write");
  const [copied, setCopied] = useState(false);
  const [title, setTitle] = useState(surface === "lorem" ? copy.sampleHeading : "");
  const [nickname, setNickname] = useState(
    surface === "lorem" ? copy.defaultNickname : profile.nickname,
  );
  const [submitting, setSubmitting] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const mode = surface === "write" || editing ? "edit" : "preview";
  const handleCopyUrl = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, []);

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
          {surface === "lorem" ? (
            <PostDetailActions
              copied={copied}
              copyLabel={copy.copyLink}
              copiedLabel={copy.copied}
              onCopy={handleCopyUrl}
              isAuthor
              editLabel={mode === "preview" ? copy.edit : undefined}
              onEdit={mode === "preview" ? () => setEditing(true) : undefined}
            />
          ) : null}
        </div>
        {surface === "lorem" && mode === "preview" ? (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <DisplayedProfileNickname
                nickname={copy.defaultNickname}
                isOwner
                size={18}
                tokenClassName="h-[18px] w-[18px]"
                nicknameClassName="text-sm font-semibold text-gray-300"
              />
              <OwnPostMark />
            </div>
            <h2 className="font-game-title text-2xl text-foreground">
              {title}
            </h2>
          </div>
        ) : null}
        {surface === "write" ? (
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
        ) : null}
      </header>
      {unavailable ? (
        <StorageUnavailableNotice title={copy.unavailableTitle} />
      ) : null}
      <Editor
        mode={mode}
        seed={surface === "lorem" ? "lorem" : "empty"}
        title={title}
        onTitleChange={mode === "edit" ? setTitle : undefined}
        nickname={nickname}
        onNicknameChange={mode === "edit" ? setNickname : undefined}
        submitLabel={copy.submit}
        submitting={submitting}
        onSubmit={mode === "edit" ? handleRegister : undefined}
      />
    </div>
  );
}

export function PagestormWriteClient({ gameCopy }: { gameCopy: PagestormGameCopy }) {
  return <PagestormDocumentClient gameCopy={gameCopy} surface="write" />;
}

export function PagestormLoremClient({ gameCopy }: { gameCopy: PagestormGameCopy }) {
  return <PagestormDocumentClient gameCopy={gameCopy} surface="lorem" />;
}
