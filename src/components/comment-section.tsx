"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "@/components/ui/static-image";
import type { EntityInfo } from "@/components/patch-note-renderer";
import type { RichContentEditorProps } from "@/components/rich-content-editor";
import { PostRenderer, buildEntityMap } from "@/components/chemicalx/post-renderer";
import {
  blocksToPlainText,
  blocksToStorageText,
} from "@/lib/chemical-utils";
import type { PostBlock } from "@/lib/chemical-types";
import { useAuth } from "@/hooks/use-auth";
import { useComments } from "@/hooks/use-comments";
import { useCommentEntities } from "@/hooks/use-comment-entities";
import { useCommentLikes } from "@/hooks/use-comment-likes";
import { useUserProfile } from "@/hooks/use-user-profile";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { serviceMessages } from "@/messages/service";
import { EngagementSpinner } from "@/components/engagement-spinner";
import { StorageUnavailableNotice } from "@/components/storage-unavailable-notice";
import { DEFAULT_USER_PROFILE } from "@/lib/user-profile";
import { buildRichContentIndexes, resolveRichContentBlocks } from "@/lib/rich-content-blocks";

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
}: {
  threadKey: string;
  initialEntities?: EntityInfo[];
  onCountChange?: (count: number) => void;
}) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].comments;
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

  const prevCount = useRef(0);
  useEffect(() => {
    if (comments.length !== prevCount.current) {
      prevCount.current = comments.length;
      onCountChange?.(comments.length);
    }
  }, [comments.length, onCountChange]);

  const [submitting, setSubmitting] = useState(false);

  const commentIds = useMemo(() => comments.map((c) => c.id), [comments]);
  const { counts: likeCounts, liked: likedSet, toggle: toggleLike } = useCommentLikes(commentIds, userId);
  const entityMap = useMemo(() => buildEntityMap(entities), [entities]);
  const richContentIndexes = useMemo(() => buildRichContentIndexes(entities), [entities]);
  const nicknameInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (blocks: PostBlock[]) => {
    const trimmed = blocksToPlainText(blocks).trim();
    const storedContent = blocksToStorageText(blocks);
    const nick = nicknameInputRef.current?.value.trim() || profile.nickname.trim() || profileFallback.nickname;
    if (!trimmed || !nick) return;

    setSubmitting(true);
    try {
      const activeUserId = userId ?? await ensureUser();
      if (!activeUserId) return;
      await add(nick, storedContent, blocks, activeUserId);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCommentLike = async (commentId: string) => {
    const activeUserId = userId ?? await ensureUser();
    if (!activeUserId) return;
    toggleLike(commentId, activeUserId);
  };

  return (
    <div className="space-y-3">
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
        <p className="text-xs text-muted-foreground">{copy.empty}</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((comment) => (
            <li key={comment.id} className="rounded-lg border border-border/50 bg-card/20 px-3 py-2.5 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium text-yellow-500">{comment.nickname}</span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(comment.created_at).toLocaleDateString(dateLocale)}
                </span>
                <button
                  onClick={() => handleCommentLike(comment.id)}
                  disabled={!ready || storageUnavailable}
                  className="flex items-center gap-0.5 text-[10px] text-muted-foreground transition-all disabled:opacity-30"
                >
                  <Image
                    src="/images/relics/runic-dodecahedron.webp"
                    alt={copy.likeAlt}
                    width={14}
                    height={14}
                    className={`transition-all ${likedSet.has(comment.id) ? "" : "opacity-40 grayscale"}`}
                  />
                  {(likeCounts.get(comment.id) ?? 0) > 0 && <span>{likeCounts.get(comment.id)}</span>}
                </button>
                {userId === comment.user_id && (
                  <button
                    onClick={() => remove(comment.id)}
                    className="text-[10px] text-muted-foreground hover:text-red-400"
                  >
                    {copy.delete}
                  </button>
                )}
              </div>
              <div className="mt-1.5 text-muted-foreground leading-relaxed break-words">
                <PostRenderer
                  blocks={resolveRichContentBlocks(comment.content, comment.content_blocks, richContentIndexes)}
                  entityMap={entityMap}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {ready && !storageUnavailable && (
        <div className="space-y-2">
          <input
            key={profile.nickname}
            ref={nicknameInputRef}
            type="text"
            placeholder={copy.nicknamePlaceholder}
            defaultValue={profile.nickname}
            maxLength={20}
            className="w-full rounded bg-zinc-800 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-yellow-500/50"
          />
          {entitiesLoading ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card/30 px-3 py-2 text-xs text-muted-foreground">
              <EngagementSpinner size={14} />
              <span>{copy.editorLoading}</span>
            </div>
          ) : (
            <RichContentEditor
              entities={entities}
              onSubmit={handleSubmit}
              placeholder={copy.placeholder}
              draftKey={getDraftKey(threadKey)}
              submitLabel={submitting ? "..." : copy.submit}
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
