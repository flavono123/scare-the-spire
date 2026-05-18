"use client";

import Link from "next/link";
import type { ChemicalPost } from "@/lib/chemical-types";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { PostRenderer } from "./post-renderer";
import { Trash2, ExternalLink } from "lucide-react";
import { localizeHref } from "@/lib/i18n";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { serviceMessages } from "@/messages/service";

interface PostCardProps {
  post: ChemicalPost;
  entityMap: Map<string, EntityInfo>;
  forceShowTooltips?: boolean;
  isOwner: boolean;
  profileNickname?: string;
  onDelete: (postId: string) => void;
}

function formatRelativeTime(template: string, count: number): string {
  return template.replace("{count}", String(count));
}

function timeAgo(
  dateStr: string,
  copy: Record<"justNow" | "minutesAgo" | "hoursAgo" | "daysAgo", string>,
  dateLocale: string,
): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return copy.justNow;
  if (minutes < 60) return formatRelativeTime(copy.minutesAgo, minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return formatRelativeTime(copy.hoursAgo, hours);
  const days = Math.floor(hours / 24);
  if (days < 30) return formatRelativeTime(copy.daysAgo, days);
  return new Date(dateStr).toLocaleDateString(dateLocale);
}

export function PostCard({ post, entityMap, forceShowTooltips, isOwner, profileNickname, onDelete }: PostCardProps) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].chemicalX;
  const dateLocale = serviceLocale === "ko" ? "ko-KR" : "en-US";

  return (
    <div className="group border border-border rounded-lg bg-card/30 px-4 py-3 transition-colors hover:border-yellow-500/20">
      {/* Header: nickname + time */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-semibold text-gray-300">
          {profileNickname ?? post.nickname}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {timeAgo(post.created_at, copy, dateLocale)}
          </span>
          <Link
            href={localizeHref(`/chemical-x/${post.id}`, serviceLocale)}
            prefetch={false}
            className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-yellow-400 transition-all"
            title={copy.share}
          >
            <ExternalLink size={14} />
          </Link>
          {isOwner && (
            <button
              type="button"
              onClick={() => onDelete(post.id)}
              className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all"
              title={copy.delete}
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
