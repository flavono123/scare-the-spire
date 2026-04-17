"use client";

import Link from "next/link";
import type { ChemicalPost } from "@/lib/chemical-types";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { PostRenderer } from "./post-renderer";
import { Trash2, ExternalLink } from "lucide-react";

interface PostCardProps {
  post: ChemicalPost;
  entityMap: Map<string, EntityInfo>;
  forceShowTooltips?: boolean;
  isOwner: boolean;
  onDelete: (postId: string) => void;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return new Date(dateStr).toLocaleDateString("ko-KR");
}

export function PostCard({ post, entityMap, forceShowTooltips, isOwner, onDelete }: PostCardProps) {
  return (
    <div className="group border border-border rounded-lg bg-card/30 px-4 py-3 transition-colors hover:border-yellow-500/20">
      {/* Header: nickname + time */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-semibold text-gray-300">
          {post.nickname}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {timeAgo(post.created_at)}
          </span>
          <Link
            href={`/chemical-x/${post.id}`}
            prefetch={false}
            className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-yellow-400 transition-all"
            title="공유"
          >
            <ExternalLink size={14} />
          </Link>
          {isOwner && (
            <button
              type="button"
              onClick={() => onDelete(post.id)}
              className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all"
              title="삭제"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="text-sm leading-relaxed">
        <PostRenderer
          blocks={post.content}
          entityMap={entityMap}
          forceShowTooltips={forceShowTooltips}
        />
      </div>
    </div>
  );
}
