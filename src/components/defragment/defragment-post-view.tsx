"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PostRenderer, buildEntityMap } from "@/components/chemicalx/post-renderer";
import { CommentSection } from "@/components/comment-section";
import { ContentLoadingNotice } from "@/components/content-loading-notice";
import { DefragmentComposer } from "@/components/defragment/defragment-composer";
import { LikeButton } from "@/components/like-button";
import { PostDetailActions } from "@/components/post-detail-actions";
import { StorageUnavailableNotice } from "@/components/storage-unavailable-notice";
import Image from "@/components/ui/static-image";
import { useAuth } from "@/hooks/use-auth";
import { useCommentEntities } from "@/hooks/use-comment-entities";
import {
  deleteDefragmentPost,
  fetchDefragmentPost,
  updateDefragmentPost,
} from "@/hooks/use-defragment-posts";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { useUserProfile } from "@/hooks/use-user-profile";
import type { PostBlock } from "@/lib/chemical-types";
import { buildDefragmentCommentThreadKey } from "@/lib/comment-threads";
import {
  DEFRAGMENT_HREF,
  DEFRAGMENT_TOKEN_SRC,
  type DefragmentPost,
} from "@/lib/defragment";
import { localizeHrefWithGameLocale, type GameLocale } from "@/lib/i18n";
import { getSiteDisplayOrigin } from "@/lib/site-origin";
import { supabaseEnabled } from "@/lib/supabase";
import { DEFAULT_USER_PROFILE } from "@/lib/user-profile";
import { serviceMessages } from "@/messages/service";
import { formatTimeAgo } from "@/lib/relative-time";

export function DefragmentPostView({
  postId,
  gameLocale,
  placeholder,
}: {
  postId: string;
  gameLocale: GameLocale;
  placeholder: string;
}) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].defragment;
  const siteDisplayOrigin = getSiteDisplayOrigin();
  const dateLocale = serviceLocale === "ko" ? "ko-KR" : "en-US";
  const router = useRouter();
  const indexHref = localizeHrefWithGameLocale(DEFRAGMENT_HREF, serviceLocale, gameLocale);
  const { userId, ready, ensureUser } = useAuth();
  const [post, setPost] = useState<DefragmentPost | null>(null);
  const [loading, setLoading] = useState(supabaseEnabled);
  const [unavailable, setUnavailable] = useState(!supabaseEnabled);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const { entities } = useCommentEntities(undefined, { enabled: Boolean(post) });
  const entityMap = useMemo(() => buildEntityMap(entities), [entities]);
  const profileFallback = useMemo(
    () => ({ ...DEFAULT_USER_PROFILE, nickname: copy.defaultNickname }),
    [copy.defaultNickname],
  );
  const { profile } = useUserProfile(profileFallback);
  const isAuthor = Boolean(userId && post && post.user_id === userId);

  useEffect(() => {
    if (!supabaseEnabled) return;
    let cancelled = false;
    fetchDefragmentPost(postId)
      .then((next) => {
        if (cancelled) return;
        setPost(next);
        setUnavailable(false);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setPost(null);
        setUnavailable(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [postId]);

  const handleCopyUrl = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, []);

  const handleUpdate = useCallback(async (input: {
    title: string;
    blocks: PostBlock[];
    nickname: string;
  }) => {
    const activeUserId = userId ?? await ensureUser();
    if (!activeUserId) return;
    try {
      const updated = await updateDefragmentPost(postId, {
        ...input,
        activeUserId,
      });
      if (!updated) return;
      setPost(updated);
      setEditing(false);
    } catch {
      setUnavailable(true);
    }
  }, [ensureUser, postId, userId]);

  const handleDelete = useCallback(async () => {
    const activeUserId = userId ?? await ensureUser();
    if (!activeUserId) return;
    try {
      const removed = await deleteDefragmentPost(postId, activeUserId);
      if (!removed) return;
      router.replace(indexHref);
    } catch {
      setUnavailable(true);
    }
  }, [ensureUser, indexHref, postId, router, userId]);

  if (unavailable) {
    return <StorageUnavailableNotice title={copy.unavailableTitle} />;
  }

  if (loading) {
    return <ContentLoadingNotice label={copy.loading} />;
  }

  if (!post) {
    return (
      <div className="space-y-4">
        <Link href={indexHref} className="text-sm text-yellow-400 hover:underline">
          {copy.backToIndex}
        </Link>
        <p className="text-sm text-muted-foreground">{copy.notFound}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-defragment-page="detail">
      <div className="flex items-start justify-between gap-3">
        <Link
          href={indexHref}
          className="inline-flex items-center gap-1 text-sm text-yellow-400 hover:underline"
        >
          <ArrowLeft size={14} />
          {copy.backToIndex}
        </Link>
        <PostDetailActions
          copied={copied}
          copyLabel={copy.copyLink}
          copiedLabel={copy.copied}
          onCopy={handleCopyUrl}
          isAuthor={isAuthor && ready}
          editLabel={copy.edit}
          onEdit={() => setEditing((value) => !value)}
          deleteLabel={copy.delete}
          onDelete={() => { void handleDelete(); }}
        />
      </div>

      <article className="rounded-lg border border-border bg-card/30 px-4 py-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="truncate text-sm font-semibold text-gray-300">
            {post.nickname}
          </span>
          <span className="text-xs text-gray-500">
            {formatTimeAgo(post.created_at, copy, dateLocale)}
          </span>
        </div>
        <h1 className="mb-3 font-service text-xl font-bold text-zinc-50">
          {post.title}
        </h1>
        {editing && isAuthor ? (
          <DefragmentComposer
            entities={entities}
            placeholder={placeholder}
            profileNickname={post.nickname || profile.nickname}
            submitLabel={copy.saveChanges}
            initialTitle={post.title}
            initialBlocks={post.content}
            draftKey={`sts-defragment-edit:${post.id}`}
            onSubmit={handleUpdate}
          />
        ) : (
          <>
            <div className="text-sm leading-relaxed">
              <PostRenderer
                blocks={post.content}
                entityMap={entityMap}
                serviceLocale={serviceLocale}
                gameLocale={gameLocale}
              />
            </div>
            <div className="mt-4">
              <LikeButton
                storyId={buildDefragmentCommentThreadKey(post.id)}
                userId={userId}
                initialCount={post.like_count ?? 0}
                size={15}
                authReady={ready}
                userStatusLoading="lazy"
                ensureUser={ensureUser}
                tipLabel={serviceMessages[serviceLocale].engagementTips.like}
                tipLabelActive={serviceMessages[serviceLocale].engagementTips.unlike}
              />
            </div>
          </>
        )}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Image
              src={DEFRAGMENT_TOKEN_SRC}
              alt=""
              width={14}
              height={14}
              className="object-contain opacity-50"
            />
            <span className="text-[11px] font-semibold tracking-wide text-yellow-500/40">
              {serviceMessages[serviceLocale].brand}
            </span>
          </div>
          <span className="text-[11px] tracking-wide text-gray-600/60">
            {siteDisplayOrigin}{DEFRAGMENT_HREF}/{postId.slice(0, 8)}
          </span>
        </div>
      </article>

      <section
        id="comments"
        className="scroll-mt-16 rounded-lg border border-border bg-card/20 p-4"
      >
        <h2 className="mb-3 font-service text-sm font-semibold text-zinc-300">
          {copy.commentsTitle}
        </h2>
        <CommentSection
          threadKey={buildDefragmentCommentThreadKey(post.id)}
          initialEntities={entities}
        />
      </section>
    </div>
  );
}
