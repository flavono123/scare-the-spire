"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { RichContentEditor } from "@/components/rich-content-editor";
import { PostRenderer, buildEntityMap } from "@/components/chemicalx/post-renderer";
import { GOLD_TERM_DESC, KEYWORD_DESC } from "@/components/codex/codex-description";
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

interface LegacyInlineCandidate {
  value: string;
  lowerValue: string;
  kind: "entity" | "keyword";
  entityId?: string;
  entityType?: EntityInfo["type"];
  description?: string;
}

function buildLegacyInlineIndex(entities: EntityInfo[]): Map<string, LegacyInlineCandidate[]> {
  const index = new Map<string, LegacyInlineCandidate[]>();
  const seen = new Set<string>();

  const addCandidate = (candidate: LegacyInlineCandidate) => {
    const normalized = candidate.lowerValue;
    if (candidate.value.length < 2 || seen.has(`${candidate.kind}:${normalized}`)) return;

    seen.add(`${candidate.kind}:${normalized}`);
    const firstChar = normalized[0];
    const bucket = index.get(firstChar) ?? [];
    bucket.push(candidate);
    index.set(firstChar, bucket);
  };

  for (const entity of entities) {
    for (const value of [entity.nameKo, entity.nameEn]) {
      const trimmed = value.trim();
      if (!trimmed) continue;
      addCandidate({
        value: trimmed,
        lowerValue: trimmed.toLowerCase(),
        kind: "entity",
        entityId: entity.id,
        entityType: entity.type,
      });
    }
  }

  for (const [value, description] of Object.entries({ ...KEYWORD_DESC, ...GOLD_TERM_DESC })) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    addCandidate({
      value: trimmed,
      lowerValue: trimmed.toLowerCase(),
      kind: "keyword",
      description,
    });
  }

  for (const bucket of index.values()) {
    bucket.sort((a, b) => {
      if (b.value.length !== a.value.length) return b.value.length - a.value.length;
      if (a.kind !== b.kind) return a.kind === "entity" ? -1 : 1;
      return a.value.localeCompare(b.value, "ko");
    });
  }

  return index;
}

function hasAsciiWordBoundary(candidate: LegacyInlineCandidate, content: string, start: number): boolean {
  if (!/[a-z0-9]/i.test(candidate.value)) return true;

  const prev = content[start - 1] ?? "";
  const next = content[start + candidate.value.length] ?? "";
  return !/[a-z0-9]/i.test(prev) && !/[a-z0-9]/i.test(next);
}

function parseLegacyCommentBlocks(content: string, index: Map<string, LegacyInlineCandidate[]>): PostBlock[] {
  const blocks: PostBlock[] = [];
  const lowerContent = content.toLowerCase();
  let cursor = 0;
  let textStart = 0;

  while (cursor < content.length) {
    const bucket = index.get(lowerContent[cursor]);
    let matched: LegacyInlineCandidate | null = null;

    if (bucket) {
      for (const candidate of bucket) {
        const slice = lowerContent.slice(cursor, cursor + candidate.value.length);
        if (slice !== candidate.lowerValue) continue;
        if (!hasAsciiWordBoundary(candidate, content, cursor)) continue;
        matched = candidate;
        break;
      }
    }

    if (!matched) {
      cursor += 1;
      continue;
    }

    if (textStart < cursor) {
      blocks.push({ type: "text", text: content.slice(textStart, cursor) });
    }

    const matchedText = content.slice(cursor, cursor + matched.value.length);
    if (matched.kind === "entity" && matched.entityId && matched.entityType) {
      blocks.push({
        type: "entity",
        entityId: matched.entityId,
        entityType: matched.entityType,
        displayText: matchedText,
      });
    } else if (matched.description) {
      blocks.push({
        type: "keyword",
        text: matchedText,
        keyword: matchedText,
        description: matched.description,
      });
    }

    cursor += matched.value.length;
    textStart = cursor;
  }

  if (textStart < content.length) {
    blocks.push({ type: "text", text: content.slice(textStart) });
  }

  return blocks.length > 0 ? blocks : [{ type: "text", text: content }];
}

function getCommentBlocks(comment: Comment, legacyInlineIndex: Map<string, LegacyInlineCandidate[]>): PostBlock[] {
  if (comment.content_blocks?.length) {
    return comment.content_blocks;
  }
  return parseLegacyCommentBlocks(comment.content, legacyInlineIndex);
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
  const legacyInlineIndex = useMemo(() => buildLegacyInlineIndex(entities), [entities]);

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
                <PostRenderer blocks={getCommentBlocks(comment, legacyInlineIndex)} entityMap={entityMap} />
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
