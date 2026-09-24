"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Trash2 } from "lucide-react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import type { RichContentEditorProps } from "@/components/rich-content-editor";
import { DisplayedProfileNickname } from "@/components/profile/displayed-profile-nickname";
import { PostRenderer, buildEntityMap } from "@/components/chemicalx/post-renderer";
import {
  blocksToPlainText,
  blocksToStorageText,
} from "@/lib/chemical-utils";
import type { HistoryRunFloorBlock, PostBlock } from "@/lib/chemical-types";
import { useAuth } from "@/hooks/use-auth";
import { useComments, type Comment } from "@/hooks/use-comments";
import { useCommentEntities } from "@/hooks/use-comment-entities";
import { useCommentLikes } from "@/hooks/use-comment-likes";
import { useUserProfile } from "@/hooks/use-user-profile";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { ColorfulPhilosopherResourceThread } from "@/components/colorful-philosophers/resource-thread";
import { LikeButton } from "@/components/like-button";
import { ResourceReactionBar } from "@/components/resource-reaction-bar";
import { COLORFUL_PHILOSOPHERS_GAME_VERSION } from "@/lib/colorful-philosophers";
import { serviceMessages } from "@/messages/service";
import { EngagementSpinner } from "@/components/engagement-spinner";
import { LikeControl } from "@/components/like-control";
import { StorageUnavailableNotice } from "@/components/storage-unavailable-notice";
import { DEFAULT_USER_PROFILE } from "@/lib/user-profile";
import { buildRichContentIndexes, resolveRichContentBlocks } from "@/lib/rich-content-blocks";
import { commentMentionsHistoryFloor, keepLastHistoryFloorMention, materializeHistoryFloorMentions } from "@/lib/history-run-floor";
import {
  COMMENT_MAX_CHARS,
  COMMENT_MIN_CHARS,
} from "@/lib/content-limits";
import { cn } from "@/lib/utils";

const RichContentEditor = dynamic<RichContentEditorProps>(
  () => import("@/components/rich-content-editor").then((mod) => mod.RichContentEditor),
  { ssr: false },
);

function getDraftKey(threadKey: string): string {
  return `sts-comment-draft:${threadKey}`;
}

export function CommentSection({
  threadKey,
  initialEntities,
  onCountChange,
  onCommentsChange,
  onHistoryFloorClick,
  activeHistoryFloor,
  historyFloorInsertRequest,
  historyFloorMentions,
  placeholder,
  floorHashTip,
  toolbarStart,
  density = "default",
}: {
  threadKey: string;
  initialEntities?: EntityInfo[];
  onCountChange?: (count: number) => void;
  onCommentsChange?: (comments: Comment[]) => void;
  onHistoryFloorClick?: (block: HistoryRunFloorBlock) => void;
  activeHistoryFloor?: { actIndex: number; step: number } | null;
  historyFloorInsertRequest?: {
    requestId: number;
    block: HistoryRunFloorBlock;
  } | null;
  historyFloorMentions?: {
    catalog: HistoryRunFloorBlock[];
    currentFloor?: number;
  } | null;
  placeholder?: string;
  floorHashTip?: {
    token: string;
    text: string;
    example: string;
  };
  toolbarStart?: ReactNode;
  density?: "default" | "inline";
}) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].comments;
  const tips = serviceMessages[serviceLocale].engagementTips;
  const dateLocale = serviceLocale === "ko" ? "ko-KR" : "en-US";
  const { userId, ready, ensureUser } = useAuth();
  const { entities, loading: entitiesLoading } = useCommentEntities(initialEntities);
  const { comments, loading, unavailable, add, remove } = useComments(threadKey, userId);
  const profileFallback = useMemo(
    () => ({ ...DEFAULT_USER_PROFILE, nickname: copy.defaultNickname }),
    [copy.defaultNickname],
  );
  const { profile } = useUserProfile(profileFallback);
  const storageUnavailable = unavailable;

  const prevCount = useRef<number | null>(null);
  useEffect(() => {
    if (!loading && comments.length !== prevCount.current) {
      prevCount.current = comments.length;
      onCountChange?.(comments.length);
    }
  }, [comments.length, loading, onCountChange]);

  useEffect(() => {
    if (loading) return;
    onCommentsChange?.(comments);
  }, [comments, loading, onCommentsChange]);

  const [submitting, setSubmitting] = useState(false);

  const commentIds = useMemo(() => comments.map((c) => c.id), [comments]);
  const { counts: likeCounts, liked: likedSet, toggle: toggleLike } = useCommentLikes(commentIds, userId);
  const entityMap = useMemo(() => buildEntityMap(entities), [entities]);
  const richContentIndexes = useMemo(() => buildRichContentIndexes(entities), [entities]);
  const nicknameInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (blocks: PostBlock[]) => {
    const resolved = keepLastHistoryFloorMention(
      historyFloorMentions?.catalog.length
        ? materializeHistoryFloorMentions(blocks, historyFloorMentions.catalog)
        : blocks,
    );
    const trimmed = blocksToPlainText(resolved).trim();
    const storedContent = blocksToStorageText(resolved);
    const nick = nicknameInputRef.current?.value.trim() || profile.nickname.trim() || profileFallback.nickname;
    if (
      !nick
      || trimmed.length < COMMENT_MIN_CHARS
      || trimmed.length > COMMENT_MAX_CHARS
    ) return;

    setSubmitting(true);
    try {
      const activeUserId = userId ?? await ensureUser();
      if (!activeUserId) return;
      await add(nick, storedContent, resolved, activeUserId);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCommentLike = async (commentId: string) => {
    const activeUserId = userId ?? await ensureUser();
    if (!activeUserId) return;
    toggleLike(commentId, activeUserId);
  };

  const inline = density === "inline";
  const codexThread = /^sts2-codex:([^:]+):(.+)$/.exec(threadKey);

  return (
    <div className={inline ? "mt-1 space-y-1 rounded-md border border-white/10 border-l-2 border-l-zinc-500 bg-zinc-950/70 px-2 py-1" : "space-y-3"}>
      {!inline && codexThread ? (
        <>
          <div className="flex items-center justify-end gap-2">
            <LikeButton
              storyId={threadKey}
              userId={userId}
              authReady={ready}
              ensureUser={ensureUser}
            />
            <ResourceReactionBar
              resourceType={codexThread[1]}
              resourceId={codexThread[2]}
              gameVersion={COLORFUL_PHILOSOPHERS_GAME_VERSION}
              variant="icons"
            />
          </div>
          <ColorfulPhilosopherResourceThread
            resourceType={codexThread[1]}
            resourceId={codexThread[2]}
          />
        </>
      ) : null}
      {storageUnavailable ? (
        <StorageUnavailableNotice
          compact
          title={copy.unavailableTitle}
        />
      ) : loading ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <EngagementSpinner size={14} />
          <span>{copy.loading}</span>
        </div>
      ) : comments.length === 0 ? (
        inline ? null : <p className="text-xs text-muted-foreground">{copy.empty}</p>
      ) : (
        <ul className={inline ? "space-y-0.5" : "space-y-3"}>
          {comments.map((comment) => {
            const active = Boolean(
              activeHistoryFloor
              && commentMentionsHistoryFloor(
                comment.content_blocks,
                activeHistoryFloor.actIndex,
                activeHistoryFloor.step,
              ),
            );
            if (inline) {
              return (
                <li
                  key={comment.id}
                  id={`history-comment-${comment.id}`}
                  data-comment-entry=""
                  className="flex items-center gap-2 py-0.5 text-xs leading-5"
                >
                  <div className="min-w-0 flex-1 break-words text-xs leading-5 text-foreground/90 [&_p]:m-0">
                    <PostRenderer
                      blocks={resolveRichContentBlocks(comment.content, comment.content_blocks, richContentIndexes)}
                      entityMap={entityMap}
                      onHistoryFloorClick={onHistoryFloorClick}
                    />
                  </div>
                  <div className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                    <DisplayedProfileNickname
                      nickname={comment.nickname}
                      isOwner={Boolean(userId && userId === comment.user_id)}
                      authorToken={comment}
                      size={12}
                      tokenClassName="h-3 w-3"
                      nicknameClassName="max-w-16 truncate text-[10px] text-primary"
                    />
                    <span className="tabular-nums">
                      {new Date(comment.created_at).toLocaleDateString(dateLocale)}
                    </span>
                    <LikeControl
                      count={likeCounts.get(comment.id) ?? 0}
                      liked={likedSet.has(comment.id)}
                      disabled={!ready || storageUnavailable}
                      onToggle={() => {
                        void handleCommentLike(comment.id);
                      }}
                      tipLabel={tips.like}
                      tipLabelActive={tips.unlike}
                      size={12}
                    />
                    {userId === comment.user_id && (
                      <button
                        type="button"
                        onClick={() => remove(comment.id)}
                        className="inline-flex text-muted-foreground transition-colors hover:text-red-300"
                        title={copy.delete}
                        aria-label={copy.delete}
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </li>
              );
            }
            return (
            <li
              key={comment.id}
              id={`history-comment-${comment.id}`}
              className={cn(
                "rounded-lg border bg-card/20 px-3 py-2.5 text-sm",
                active
                  ? "border-amber-400/50 bg-amber-400/5"
                  : "border-border/50",
              )}
            >
              <div className="flex items-center gap-2">
                <DisplayedProfileNickname
                  nickname={comment.nickname}
                  isOwner={Boolean(userId && userId === comment.user_id)}
                  authorToken={comment}
                  size={16}
                  tokenClassName="h-4 w-4"
                  nicknameClassName="font-medium text-primary"
                />
                <span className="text-[10px] text-muted-foreground">
                  {new Date(comment.created_at).toLocaleDateString(dateLocale)}
                </span>
                <LikeControl
                  count={likeCounts.get(comment.id) ?? 0}
                  liked={likedSet.has(comment.id)}
                  disabled={!ready || storageUnavailable}
                  onToggle={() => {
                    void handleCommentLike(comment.id);
                  }}
                  tipLabel={tips.like}
                  tipLabelActive={tips.unlike}
                  size={14}
                />
                {userId === comment.user_id && (
                  <button
                    type="button"
                    onClick={() => remove(comment.id)}
                    className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground transition-colors hover:text-red-300"
                    title={copy.delete}
                  >
                    <Trash2 size={12} />
                    <span>{copy.delete}</span>
                  </button>
                )}
              </div>
              <div className="mt-1.5 leading-relaxed break-words whitespace-pre-wrap text-muted-foreground">
                <PostRenderer
                  blocks={resolveRichContentBlocks(comment.content, comment.content_blocks, richContentIndexes)}
                  entityMap={entityMap}
                  onHistoryFloorClick={onHistoryFloorClick}
                />
              </div>
            </li>
            );
          })}
        </ul>
      )}

      {ready && !storageUnavailable && (
        <div className={inline ? "" : "space-y-2"}>
          {!inline && (
          <input
            key={profile.nickname}
            ref={nicknameInputRef}
            type="text"
            placeholder={copy.nicknamePlaceholder}
            defaultValue={profile.nickname}
            maxLength={20}
            className="service-input"
          />
          )}
          {entitiesLoading ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card/30 px-3 py-2 text-xs text-muted-foreground">
              <EngagementSpinner size={14} />
              <span>{copy.editorLoading}</span>
            </div>
          ) : (
            <RichContentEditor
              entities={entities}
              onSubmit={handleSubmit}
              placeholder={placeholder ?? copy.placeholder}
              draftKey={getDraftKey(threadKey)}
              submitLabel={submitting ? "..." : copy.submit}
              minChars={COMMENT_MIN_CHARS}
              maxChars={COMMENT_MAX_CHARS}
              allowLineBreaks
              density={inline ? "inline" : "default"}
              historyFloorInsertRequest={historyFloorInsertRequest}
              historyFloorMentions={historyFloorMentions}
              floorHashTip={floorHashTip}
              toolbarStart={toolbarStart}
            />
          )}
        </div>
      )}
    </div>
  );
}

export function CommentCount({ threadKey }: { threadKey: string }) {
  const { comments } = useComments(threadKey, null);
  return (
    <span className="text-xs text-muted-foreground">
      {comments.length}
    </span>
  );
}
