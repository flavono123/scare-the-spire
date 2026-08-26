"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CommentSection } from "@/components/comment-section";
import { ContentLoadingNotice } from "@/components/content-loading-notice";
import { DecisionsDecisionsBoard } from "@/components/decisions-decisions/decisions-decisions-board";
import { DecisionsDecisionsComposer } from "@/components/decisions-decisions/decisions-decisions-composer";
import { LikeButton } from "@/components/like-button";
import { PostDetailActions } from "@/components/post-detail-actions";
import { StorageUnavailableNotice } from "@/components/storage-unavailable-notice";
import { TransfigureImageCopyButton } from "@/components/transfigure/transfigure-image-copy-button";
import { useAuth } from "@/hooks/use-auth";
import { useDecisionsDecisionsCatalog } from "@/hooks/use-decisions-decisions-catalog";
import { useDecisionsDecisionsPost } from "@/hooks/use-decisions-decisions-posts";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { useUserProfile } from "@/hooks/use-user-profile";
import type { DecisionsDecisionsGameCopy } from "@/lib/borrowed-game-copy";
import { buildDecisionsDecisionsCommentThreadKey } from "@/lib/comment-threads";
import {
  DECISIONS_DECISIONS_HREF,
  DECISIONS_DECISIONS_TOKEN_SRC,
  placementText,
  resourceKey,
} from "@/lib/decisions-decisions";
import type { GameLocale } from "@/lib/i18n";
import { localizeHrefWithGameLocale } from "@/lib/i18n";
import { formatTimeAgo } from "@/lib/relative-time";
import { DEFAULT_USER_PROFILE } from "@/lib/user-profile";
import { serviceMessages } from "@/messages/service";
import Image from "@/components/ui/static-image";

export function DecisionsDecisionsPostView({
  postId,
  gameLocale,
  gameCopy,
  variant = "page",
}: {
  postId: string;
  gameLocale: GameLocale;
  gameCopy: DecisionsDecisionsGameCopy;
  variant?: "page" | "embed";
}) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].decisionsDecisions;
  const dateLocale = serviceLocale === "ko" ? "ko-KR" : "en-US";
  const router = useRouter();
  const { userId, ready, ensureUser } = useAuth();
  const { post, loading, unavailable, update, remove } = useDecisionsDecisionsPost(postId, userId);
  const catalog = useDecisionsDecisionsCatalog(gameLocale);
  const profileFallback = useMemo(
    () => ({ ...DEFAULT_USER_PROFILE, nickname: copy.defaultNickname }),
    [copy.defaultNickname],
  );
  const { profile } = useUserProfile(profileFallback);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showNames, setShowNames] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const isEmbed = variant === "embed";
  const indexHref = localizeHrefWithGameLocale(DECISIONS_DECISIONS_HREF, serviceLocale, gameLocale);
  const threadKey = buildDecisionsDecisionsCommentThreadKey(postId);

  const pool = useMemo(() => {
    if (!post) return [];
    const stamped = catalog.stamps[post.preset_key] ?? [];
    const seen = new Set(stamped.map(resourceKey));
    return [...stamped, ...post.extra_ids.filter((ref) => !seen.has(resourceKey(ref)))];
  }, [catalog.stamps, post]);

  const handleCopyUrl = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, []);

  const handleDelete = useCallback(async () => {
    const removed = await remove();
    if (!removed) return;
    if (!isEmbed) router.push(indexHref);
  }, [indexHref, isEmbed, remove, router]);

  if (unavailable) {
    return <StorageUnavailableNotice title={copy.unavailableTitle} />;
  }
  if (loading || catalog.loading) {
    return <ContentLoadingNotice label={copy.loading} />;
  }
  if (!post) {
    return <p className="text-sm text-muted-foreground">{copy.notFound}</p>;
  }

  const isAuthor = Boolean(userId && post.user_id === userId);

  return (
    <div data-decisions-decisions-embed={isEmbed ? "true" : undefined} className="space-y-6">
      {!isEmbed && (
        <div className="flex items-start justify-between gap-3">
          <Link
            href={indexHref}
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <ArrowLeft size={14} />
            {copy.backToIndex}
          </Link>
          <PostDetailActions
            copied={copied}
            copyLabel={copy.copyLink}
            copiedLabel={copy.copied}
            onCopy={handleCopyUrl}
            isAuthor={isAuthor}
            editLabel={copy.edit}
            onEdit={() => setEditing(true)}
            deleteLabel={copy.delete}
            onDelete={() => { void handleDelete(); }}
          />
        </div>
      )}

      <header className="flex items-center gap-3">
        <Image
          src={DECISIONS_DECISIONS_TOKEN_SRC}
          alt=""
          width={32}
          height={32}
          className="object-contain"
        />
        <div className="min-w-0">
          <h1 className="font-service text-xl font-bold spire-gold">{post.title}</h1>
          <p className="text-xs text-muted-foreground">
            {post.nickname} · {formatTimeAgo(post.created_at, copy, dateLocale)} · {copy.version.replace("{version}", post.game_version)}
          </p>
        </div>
      </header>

      {post.note && <p className="text-sm text-zinc-300">{post.note}</p>}

      {editing && isAuthor ? (
        <DecisionsDecisionsComposer
          entities={catalog.entities}
          entityMap={catalog.entityMap}
          stamps={catalog.stamps}
          gameLocale={gameLocale}
          serviceLocale={serviceLocale}
          presetLabels={gameCopy.presetLabels}
          submitLabel={copy.saveChanges}
          profileNickname={profile.nickname}
          initial={post}
          onClose={() => setEditing(false)}
          onSubmit={async (values) => {
            const activeUserId = userId ?? await ensureUser();
            if (!activeUserId) return false;
            const next = await update({ ...values, activeUserId });
            if (next) setEditing(false);
            return Boolean(next);
          }}
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowNames(true)}
              className="text-xs text-primary"
            >
              {copy.exportNamed}
            </button>
            <button
              type="button"
              onClick={() => setShowNames(false)}
              className="text-xs text-primary"
            >
              {copy.exportCompact}
            </button>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(placementText(post, catalog.entityMap));
              }}
              className="text-xs text-primary"
            >
              {copy.exportText}
            </button>
            <TransfigureImageCopyButton
              fileName={`${post.title}.png`}
              targetRef={boardRef}
              labels={{
                copy: copy.exportNamed,
                copying: copy.copying,
                copied: copy.copied,
                copyFailed: copy.copyFailed,
                copyUnsupported: copy.copyUnsupported,
                download: copy.download,
                downloading: copy.downloading,
                downloaded: copy.downloaded,
                downloadFailed: copy.downloadFailed,
              }}
            />
          </div>
          <div ref={boardRef}>
            <DecisionsDecisionsBoard
              rows={post.rows}
              placements={post.placements}
              pool={pool}
              entitiesByKey={catalog.entityMap}
              serviceLocale={serviceLocale}
              gameLocale={gameLocale}
              showNames={showNames}
              selectedKey={null}
              readOnly
            />
          </div>
        </>
      )}

      {!isEmbed && (
        <LikeButton
          storyId={threadKey}
          userId={userId}
          initialCount={post.like_count}
          size={15}
          authReady={ready}
          userStatusLoading="lazy"
          ensureUser={ensureUser}
        />
      )}

      {!isEmbed && (
        <section
          id="comments"
          className="scroll-mt-16 rounded-lg border border-border bg-card/20 p-4"
        >
          <h2 className="mb-3 font-service text-sm font-semibold text-zinc-300">
            {copy.commentsTitle}
          </h2>
          <CommentSection threadKey={threadKey} />
        </section>
      )}
    </div>
  );
}
