"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useComments } from "@/hooks/use-comments";
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

function getDraft(storyId: string): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(`sts-draft:${storyId}`) ?? "";
}

function setDraft(storyId: string, value: string) {
  if (value) sessionStorage.setItem(`sts-draft:${storyId}`, value);
  else sessionStorage.removeItem(`sts-draft:${storyId}`);
}

export function CommentSection({ storyId, userId, onCountChange }: { storyId: string; userId: string | null; onCountChange?: (count: number) => void }) {
  const { comments, loading, add, remove } = useComments(storyId, userId);

  const prevCount = useRef(0);
  useEffect(() => {
    if (comments.length !== prevCount.current) {
      prevCount.current = comments.length;
      onCountChange?.(comments.length);
    }
  }, [comments.length, onCountChange]);

  const [nickname, setNickname] = useState(getNickname);
  const [content, setContent] = useState(() => getDraft(storyId));
  const [submitting, setSubmitting] = useState(false);

  const commentIds = useMemo(() => comments.map((c) => c.id), [comments]);
  const { counts: likeCounts, liked: likedSet, toggle: toggleLike } = useCommentLikes(commentIds, userId);

  const handleContentChange = (value: string) => {
    setContent(value);
    setDraft(storyId, value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    const nick = nickname.trim();
    if (!trimmed || !nick || !userId) return;

    setSubmitting(true);
    setNicknameStorage(nick);
    await add(nick, trimmed);
    setContent("");
    setDraft(storyId, "");
    setSubmitting(false);
  };

  return (
    <div className="space-y-3">
      {/* Comment list */}
      {loading ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <EngagementSpinner size={14} />
          <span>불러오는 중...</span>
        </div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground">아직 댓글이 없습니다</p>
      ) : (
        <ul className="space-y-2">
          {comments.map((c) => (
            <li key={c.id} className="text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium text-yellow-500">{c.nickname}</span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(c.created_at).toLocaleDateString("ko-KR")}
                </span>
                <button
                  onClick={() => toggleLike(c.id)}
                  disabled={!userId}
                  className="flex items-center gap-0.5 text-[10px] text-muted-foreground transition-all disabled:opacity-30"
                >
                  <Image
                    src="/images/relics/runic-dodecahedron.webp"
                    alt="like"
                    width={14}
                    height={14}
                    className={`transition-all ${likedSet.has(c.id) ? "" : "opacity-40 grayscale"}`}
                  />
                  {(likeCounts.get(c.id) ?? 0) > 0 && <span>{likeCounts.get(c.id)}</span>}
                </button>
                {userId === c.user_id && (
                  <button
                    onClick={() => remove(c.id)}
                    className="text-[10px] text-muted-foreground hover:text-red-400"
                  >
                    삭제
                  </button>
                )}
              </div>
              <p className="text-muted-foreground">{c.content}</p>
            </li>
          ))}
        </ul>
      )}

      {/* Comment form */}
      {userId && (
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="닉네임"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
              className="w-24 rounded bg-zinc-800 px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-yellow-500/50"
            />
            <input
              type="text"
              placeholder="댓글을 입력하세요"
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              maxLength={500}
              className="flex-1 rounded bg-zinc-800 px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-yellow-500/50"
            />
            <button
              type="submit"
              disabled={submitting || !content.trim() || !nickname.trim()}
              className="rounded bg-yellow-500/20 px-3 py-1 text-xs font-medium text-yellow-500 hover:bg-yellow-500/30 disabled:opacity-50"
            >
              작성
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function CommentCount({ storyId, userId }: { storyId: string; userId: string | null }) {
  const { comments } = useComments(storyId, userId);
  return (
    <span className="text-xs text-muted-foreground">
      {comments.length}
    </span>
  );
}
