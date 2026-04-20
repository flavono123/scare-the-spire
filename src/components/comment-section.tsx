"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { RichContentEditor } from "@/components/rich-content-editor";
import { PostRenderer, buildEntityMap } from "@/components/chemicalx/post-renderer";
import { blocksToPlainText } from "@/lib/chemical-utils";
import type { PostBlock } from "@/lib/chemical-types";
import { useAuth } from "@/hooks/use-auth";
import { useComments, type Comment } from "@/hooks/use-comments";
import { useCommentEntities } from "@/hooks/use-comment-entities";
import { useCommentLikes } from "@/hooks/use-comment-likes";
import { EngagementSpinner } from "@/components/engagement-spinner";

const NICKNAME_KEY = "sts-nickname";

function getNickname(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(NICKNAME_KEY) ?? "";
}

function setNicknameStorage(name: string) {
  localStorage.setItem(NICKNAME_KEY, name);
}

function getDraftKey(threadKey: string): string {
  return `sts-comment-draft:${threadKey}`;
}

function getCommentBlocks(comment: Comment): PostBlock[] {
  if (comment.content_blocks?.length) {
    return comment.content_blocks;
  }
  return [{ type: "text", text: comment.content }];
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
  const { userId, ready } = useAuth();
  const { entities, loading: entitiesLoading } = useCommentEntities(initialEntities);
  const { comments, loading, add, remove } = useComments(threadKey, userId);

  const prevCount = useRef(0);
  useEffect(() => {
    if (comments.length !== prevCount.current) {
      prevCount.current = comments.length;
      onCountChange?.(comments.length);
    }
  }, [comments.length, onCountChange]);

  const [nickname, setNickname] = useState(getNickname);
  const [submitting, setSubmitting] = useState(false);

  const commentIds = useMemo(() => comments.map((c) => c.id), [comments]);
  const { counts: likeCounts, liked: likedSet, toggle: toggleLike } = useCommentLikes(commentIds, userId);
  const entityMap = useMemo(() => buildEntityMap(entities), [entities]);

  const handleSubmit = async (blocks: PostBlock[]) => {
    const trimmed = blocksToPlainText(blocks).trim();
    const nick = nickname.trim();
    if (!trimmed || !nick || !userId) return;

    setSubmitting(true);
    setNicknameStorage(nick);
    await add(nick, trimmed, blocks);
    setSubmitting(false);
  };

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <EngagementSpinner size={14} />
          <span>불러오는 중...</span>
        </div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground">아직 댓글이 없습니다</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((comment) => (
            <li key={comment.id} className="rounded-lg border border-border/50 bg-card/20 px-3 py-2.5 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium text-yellow-500">{comment.nickname}</span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(comment.created_at).toLocaleDateString("ko-KR")}
                </span>
                <button
                  onClick={() => toggleLike(comment.id)}
                  disabled={!userId}
                  className="flex items-center gap-0.5 text-[10px] text-muted-foreground transition-all disabled:opacity-30"
                >
                  <Image
                    src="/images/relics/runic-dodecahedron.webp"
                    alt="like"
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
                    삭제
                  </button>
                )}
              </div>
              <div className="mt-1.5 text-muted-foreground leading-relaxed break-words">
                <PostRenderer blocks={getCommentBlocks(comment)} entityMap={entityMap} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {ready && userId && (
        <div className="space-y-2">
          <input
            type="text"
            placeholder="닉네임"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={20}
            className="w-full rounded bg-zinc-800 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-yellow-500/50"
          />
          {entitiesLoading ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card/30 px-3 py-2 text-xs text-muted-foreground">
              <EngagementSpinner size={14} />
              <span>댓글 입력기를 준비하는 중...</span>
            </div>
          ) : (
            <RichContentEditor
              entities={entities}
              onSubmit={handleSubmit}
              placeholder="댓글을 입력하세요"
              draftKey={getDraftKey(threadKey)}
              submitLabel={submitting ? "..." : "작성"}
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
