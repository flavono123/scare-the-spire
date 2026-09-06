"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CommentSection } from "@/components/comment-section";
import { ContentLoadingNotice } from "@/components/content-loading-notice";
import { LikeButton } from "@/components/like-button";
import { OwnPostMark } from "@/components/own-post-mark";
import { DisplayedProfileNickname } from "@/components/profile/displayed-profile-nickname";
import { PostDetailActions } from "@/components/post-detail-actions";
import { StorageUnavailableNotice } from "@/components/storage-unavailable-notice";
import { useAuth } from "@/hooks/use-auth";
import { useCommentEntities } from "@/hooks/use-comment-entities";
import { useGameLocale } from "@/hooks/use-game-locale";
import { usePagestormPost } from "@/hooks/use-pagestorm-posts";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { useUserProfile } from "@/hooks/use-user-profile";
import type { PagestormGameCopy } from "@/lib/borrowed-game-copy";
import { buildPagestormCommentThreadKey } from "@/lib/comment-threads";
import { localizeHrefWithGameLocale } from "@/lib/i18n";
import { PAGESTORM_HREF } from "@/lib/pagestorm";
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

export function PagestormPostView({
  postId,
  variant = "page",
}: {
  postId: string;
  gameCopy?: PagestormGameCopy;
  variant?: "page" | "embed";
}) {
  const serviceLocale = useServiceLocale();
  const gameLocale = useGameLocale();
  const copy = serviceMessages[serviceLocale].pagestorm;
  const tips = serviceMessages[serviceLocale].engagementTips;
  const router = useRouter();
  const { userId, ready, ensureUser } = useAuth();
  const { entities } = useCommentEntities();
  const { post, loading, unavailable, update, remove, setUnavailable } = usePagestormPost(
    postId,
    userId,
  );
  const profileFallback = useMemo(
    () => ({ ...DEFAULT_USER_PROFILE, nickname: copy.defaultNickname }),
    [copy.defaultNickname],
  );
  const { profile } = useUserProfile(profileFallback);
  const indexHref = localizeHrefWithGameLocale(PAGESTORM_HREF, serviceLocale, gameLocale);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [nickname, setNickname] = useState(profile.nickname);
  const [submitting, setSubmitting] = useState(false);
  const isOwner = Boolean(userId && post?.user_id === userId);
  const mode = editing ? "edit" : "preview";
  const embed = variant === "embed";
  const threadKey = buildPagestormCommentThreadKey(postId);

  const handleCopyUrl = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, []);

  const startEdit = useCallback(() => {
    if (!post) return;
    setTitle(post.title);
    setNickname(post.nickname);
    setEditing(true);
  }, [post]);

  const handleSave = useCallback(async (input: PagestormEditorSaveInput) => {
    setSubmitting(true);
    try {
      const activeUserId = userId ?? await ensureUser();
      if (!activeUserId) {
        setUnavailable(true);
        return;
      }
      const next = await update({ ...input, activeUserId });
      if (!next) {
        setUnavailable(true);
        return;
      }
      setEditing(false);
    } catch {
      setUnavailable(true);
    } finally {
      setSubmitting(false);
    }
  }, [ensureUser, setUnavailable, update, userId]);

  const handleDelete = useCallback(async () => {
    const deleted = await remove();
    if (deleted) router.replace(indexHref);
  }, [indexHref, remove, router]);

  if (unavailable) {
    return (
      <div className="space-y-4">
        {!embed && (
          <Link
            href={indexHref}
            className="inline-flex min-w-0 items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-primary"
          >
            <ArrowLeft size={16} />
            {copy.backToIndex}
          </Link>
        )}
        <StorageUnavailableNotice title={copy.unavailableTitle} />
      </div>
    );
  }

  if (loading) {
    return <ContentLoadingNotice label={copy.loading} />;
  }

  if (!post) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-sm text-gray-500">{copy.notFound}</p>
        {!embed && (
          <Link href={indexHref} className="text-sm text-primary hover:underline">
            {copy.backToIndex}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4" data-pagestorm-page={embed ? "embed" : "detail"}>
      {!embed && (
        <header className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href={indexHref}
              className="inline-flex min-w-0 items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-primary"
            >
              <ArrowLeft size={16} />
              {copy.backToIndex}
            </Link>
            <PostDetailActions
              copied={copied}
              copyLabel={copy.copyLink}
              copiedLabel={copy.copied}
              onCopy={handleCopyUrl}
              isAuthor={isOwner}
              editLabel={mode === "preview" ? copy.edit : undefined}
              onEdit={mode === "preview" ? startEdit : undefined}
              deleteLabel={copy.delete}
              onDelete={handleDelete}
            />
          </div>
          {mode === "preview" ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <DisplayedProfileNickname
                  nickname={post.nickname}
                  isOwner={isOwner}
                  size={18}
                  tokenClassName="h-[18px] w-[18px]"
                  nicknameClassName="text-sm font-semibold text-gray-300"
                />
                {isOwner ? <OwnPostMark /> : null}
              </div>
              <h2 className="font-game-title text-2xl text-foreground">
                {post.title}
              </h2>
            </div>
          ) : null}
        </header>
      )}
      {embed && mode === "preview" ? (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <DisplayedProfileNickname
              nickname={post.nickname}
              isOwner={isOwner}
              size={18}
              tokenClassName="h-[18px] w-[18px]"
              nicknameClassName="text-sm font-semibold text-gray-300"
            />
            {isOwner ? <OwnPostMark /> : null}
          </div>
          <h2 className="font-game-title text-2xl text-foreground">
            {post.title}
          </h2>
        </div>
      ) : null}
      <Editor
        key={`${post.id}:${mode}`}
        mode={mode}
        initialContent={post.content}
        title={editing ? title : post.title}
        onTitleChange={editing ? setTitle : undefined}
        nickname={editing ? nickname : post.nickname}
        onNicknameChange={editing ? setNickname : undefined}
        submitLabel={copy.saveChanges}
        submitting={submitting}
        onSubmit={editing ? handleSave : undefined}
      />
      {!embed && (
        <LikeButton
          storyId={threadKey}
          userId={userId}
          size={15}
          authReady={ready}
          userStatusLoading="lazy"
          ensureUser={ensureUser}
          tipLabel={tips.like}
          tipLabelActive={tips.unlike}
        />
      )}
      {!embed && (
        <section
          id="comments"
          className="scroll-mt-16 rounded-lg border border-border bg-card/20 p-4"
        >
          <h2 className="mb-3 font-service text-sm font-semibold text-zinc-300">
            {serviceMessages[serviceLocale].combo.commentsTitle}
          </h2>
          <CommentSection threadKey={threadKey} initialEntities={entities} />
        </section>
      )}
    </div>
  );
}
