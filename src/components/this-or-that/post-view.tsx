"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CommentSection } from "@/components/comment-section";
import { ContentLoadingNotice } from "@/components/content-loading-notice";
import { PostDetailActions } from "@/components/post-detail-actions";
import { StorageUnavailableNotice } from "@/components/storage-unavailable-notice";
import { useAuth } from "@/hooks/use-auth";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { useThisOrThatEntities } from "@/hooks/use-this-or-that-entities";
import { useThisOrThatLikes } from "@/hooks/use-this-or-that-likes";
import { useThisOrThatPost } from "@/hooks/use-this-or-that-posts";
import { useThisOrThatVotes } from "@/hooks/use-this-or-that-votes";
import { buildThisOrThatCommentThreadKey } from "@/lib/comment-threads";
import type { GameLocale } from "@/lib/i18n";
import { localizeHrefWithGameLocale } from "@/lib/i18n";
import {
  buildThisOrThatEntityMap,
  resolveThisOrThatPost,
} from "@/lib/this-or-that";
import { serviceMessages } from "@/messages/service";
import { ThisOrThatLikeButton } from "@/components/this-or-that/like-button";
import { ThisOrThatResourcePanel } from "@/components/this-or-that/resource-panel";
import {
  ThisOrThatVoteChoiceFrame,
  ThisOrThatVoteStatus,
} from "@/components/this-or-that/vote-display";
import { EMPTY_THIS_OR_THAT_VOTE_SUMMARY } from "@/lib/this-or-that-votes";
import { cn } from "@/lib/utils";

export function ThisOrThatPostView({
  postId,
  gameLocale,
  title,
  votePrompt,
  voteDone,
  variant = "page",
}: {
  postId: string;
  gameLocale: GameLocale;
  title: string;
  votePrompt: string;
  voteDone: string;
  variant?: "page" | "embed";
}) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].thisOrThat;
  const tips = serviceMessages[serviceLocale].engagementTips;
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const { userId, ready: authReady, unavailable: authUnavailable, ensureUser } = useAuth();
  const { post, loading, unavailable, remove } = useThisOrThatPost(postId, userId);
  const {
    entities,
    loading: resourcesLoading,
  } = useThisOrThatEntities(gameLocale);
  const postIds = useMemo(() => post ? [post.id] : [], [post]);
  const seedLikeCounts = useMemo(
    () => (post ? { [post.id]: post.like_count ?? 0 } : {}),
    [post],
  );
  const likes = useThisOrThatLikes(postIds, userId, seedLikeCounts);
  const votes = useThisOrThatVotes(postIds, userId, ensureUser);
  const entityMap = useMemo(() => buildThisOrThatEntityMap(entities), [entities]);
  const resolvedPost = useMemo(
    () => (post ? resolveThisOrThatPost(post, entityMap) : null),
    [entityMap, post],
  );
  const handleToggleLike = async () => {
    if (!post) return;
    const activeUserId = userId ?? await ensureUser();
    if (!activeUserId) return;
    await likes.toggle(post.id, activeUserId);
  };
  const handleCopyUrl = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, []);
  const handleDelete = useCallback(async () => {
    const removed = await remove();
    if (!removed) return;
    router.replace(
      localizeHrefWithGameLocale("/this-or-that", serviceLocale, gameLocale),
    );
  }, [gameLocale, remove, router, serviceLocale]);

  const embed = variant === "embed";

  if (unavailable) {
    return <StorageUnavailableNotice title={copy.unavailableTitle} />;
  }

  if (loading || resourcesLoading) {
    return <ContentLoadingNotice label={copy.loading} />;
  }

  if (!resolvedPost?.leftEntity || !resolvedPost.rightEntity) {
    return (
      <div className="py-12 text-center">
        <p className="mb-4 text-sm text-muted-foreground">{copy.notFound}</p>
        {!embed && (
          <Link
            href={localizeHrefWithGameLocale("/this-or-that", serviceLocale, gameLocale)}
            className="text-sm text-yellow-400 underline-offset-4 hover:underline"
          >
            {title}
          </Link>
        )}
      </div>
    );
  }

  const { leftEntity, rightEntity } = resolvedPost;
  const voteChoice = votes.choices[resolvedPost.post.id];
  const votePending = votes.pending.has(resolvedPost.post.id);
  const canVote = authReady && !authUnavailable && !votes.loading && !votes.unavailable;

  return (
    <div className="space-y-5">
      {!embed && (
      <div className="flex items-center justify-between gap-3">
        <Link
          href={localizeHrefWithGameLocale("/this-or-that", serviceLocale, gameLocale)}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-[#d4a843]"
        >
          <ArrowLeft size={16} />
          {title}
        </Link>
        <PostDetailActions
          copied={copied}
          copyLabel={copy.copyLink}
          copiedLabel={copy.copied}
          onCopy={handleCopyUrl}
          isAuthor={authReady && userId === resolvedPost.post.user_id}
          deleteLabel={copy.delete}
          onDelete={handleDelete}
        />
      </div>
      )}

      <article className="space-y-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="whitespace-pre-wrap break-words font-game-title text-2xl font-semibold leading-snug spire-gold md:text-3xl">
              {resolvedPost.post.reason}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="truncate">{resolvedPost.post.nickname}</span>
              <span aria-hidden="true">·</span>
              <span>
                {new Date(resolvedPost.post.created_at).toLocaleDateString(serviceLocale === "ko" ? "ko-KR" : "en-US")}
              </span>
            </div>
          </div>
          <ThisOrThatLikeButton
            count={likes.counts[resolvedPost.post.id] ?? resolvedPost.post.like_count ?? 0}
            liked={likes.liked.has(resolvedPost.post.id)}
            loading={likes.loading}
            unavailable={likes.unavailable}
            disabled={!authReady || authUnavailable}
            onToggle={handleToggleLike}
            label={copy.like}
            tipLabel={tips.like}
            tipLabelActive={tips.unlike}
            className="shrink-0"
          />
        </header>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-stretch">
          <div className="min-w-0">
            <div className={cn("transition-[filter,opacity]", voteChoice === "right" && "opacity-50 grayscale")}>
              <ThisOrThatResourcePanel
                entity={leftEntity}
                sideLabel={copy.leftLabel}
                serviceLocale={serviceLocale}
                gameLocale={gameLocale}
                size="large"
                assetOnly
                linkAsset
              />
            </div>
            <div className="relative mt-2 rounded-md focus-within:outline focus-within:outline-2 focus-within:outline-cyan-300/80">
              <button
                type="button"
                onClick={() => votes.vote(resolvedPost.post.id, "left", "detail")}
                disabled={!canVote || votePending || Boolean(voteChoice)}
                aria-label={copy.choose.replace("{name}", leftEntity.nameKo).replace("{side}", copy.leftLabel)}
                aria-pressed={voteChoice === "left"}
                className="absolute inset-0 z-10 rounded-md disabled:cursor-not-allowed"
              />
              <div className="pointer-events-none">
                <ThisOrThatVoteChoiceFrame side="left" label={copy.leftLabel} choice={voteChoice} />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center font-game-title text-2xl font-black text-yellow-500/80 md:w-12">
            VS
          </div>
          <div className="min-w-0">
            <div className={cn("transition-[filter,opacity]", voteChoice === "left" && "opacity-50 grayscale")}>
              <ThisOrThatResourcePanel
                entity={rightEntity}
                sideLabel={copy.rightLabel}
                serviceLocale={serviceLocale}
                gameLocale={gameLocale}
                size="large"
                assetOnly
                linkAsset
              />
            </div>
            <div className="relative mt-2 rounded-md focus-within:outline focus-within:outline-2 focus-within:outline-pink-300/80">
              <button
                type="button"
                onClick={() => votes.vote(resolvedPost.post.id, "right", "detail")}
                disabled={!canVote || votePending || Boolean(voteChoice)}
                aria-label={copy.choose.replace("{name}", rightEntity.nameKo).replace("{side}", copy.rightLabel)}
                aria-pressed={voteChoice === "right"}
                className="absolute inset-0 z-10 rounded-md disabled:cursor-not-allowed"
              />
              <div className="pointer-events-none">
                <ThisOrThatVoteChoiceFrame side="right" label={copy.rightLabel} choice={voteChoice} />
              </div>
            </div>
          </div>
        </div>

        <ThisOrThatVoteStatus
          summary={votes.summaries[resolvedPost.post.id] ?? EMPTY_THIS_OR_THAT_VOTE_SUMMARY}
          choice={voteChoice}
          prompt={votePrompt}
          done={voteDone}
          voteCountTemplate={copy.voteCount}
          voteBreakdownTemplate={copy.voteBreakdown}
          retryLabel={copy.retry}
          loading={votes.loading}
          pending={votePending}
          unavailable={votes.unavailable || authUnavailable}
          onRetry={() => votes.cancel(resolvedPost.post.id)}
        />
      </article>

      {!embed && (
      <section
        id="comments"
        className="scroll-mt-16 rounded-lg border border-border bg-card/20 p-4"
      >
        <h2 className="mb-3 font-service text-sm font-semibold text-zinc-300">
          {copy.commentsTitle}
        </h2>
        <CommentSection
          threadKey={buildThisOrThatCommentThreadKey(resolvedPost.post.id)}
          initialEntities={entities}
        />
      </section>
      )}
    </div>
  );
}
