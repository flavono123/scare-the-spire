"use client";

import { useCallback, type KeyboardEvent, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Trash2 } from "lucide-react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { PostRenderer } from "@/components/chemicalx/post-renderer";
import Image from "@/components/ui/static-image";
import {
  localizeHrefWithGameLocale,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import type { TransfigurePost } from "@/lib/transfigure-types";
import { serviceMessages } from "@/messages/service";

interface TransfigurePostCardProps {
  post: TransfigurePost;
  entityMap: Map<string, EntityInfo>;
  isOwner: boolean;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  onDelete: (postId: string) => void;
}

function formatRelativeTime(template: string, count: number): string {
  return template.replace("{count}", String(count));
}

function timeAgo(
  dateString: string,
  copy: Record<"justNow" | "minutesAgo" | "hoursAgo" | "daysAgo", string>,
  dateLocale: string,
): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return copy.justNow;
  if (minutes < 60) return formatRelativeTime(copy.minutesAgo, minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return formatRelativeTime(copy.hoursAgo, hours);
  const days = Math.floor(hours / 24);
  if (days < 30) return formatRelativeTime(copy.daysAgo, days);
  return new Date(dateString).toLocaleDateString(dateLocale);
}

export function TransfigurePostCard({
  post,
  entityMap,
  isOwner,
  serviceLocale,
  gameLocale,
  onDelete,
}: TransfigurePostCardProps) {
  const copy = serviceMessages[serviceLocale].transfigure;
  const dateLocale = serviceLocale === "ko" ? "ko-KR" : "en-US";
  const resource = entityMap.get(`${post.resource_type}:${post.resource_id}`);
  const router = useRouter();
  const href = localizeHrefWithGameLocale(
    `/transfigure/${post.id}`,
    serviceLocale,
    gameLocale,
  );
  const openPost = useCallback(() => {
    router.push(href);
  }, [href, router]);
  const handleClick = useCallback((event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("a, button, [role='button']")) return;
    openPost();
  }, [openPost]);
  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openPost();
  }, [openPost]);

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="group cursor-pointer rounded-xl border border-yellow-500/15 bg-[#090c15]/75 px-4 py-3 transition-[transform,border-color,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-yellow-300/30 hover:bg-[#0b101b]/85 hover:shadow-lg hover:shadow-black/25 focus-visible:outline focus-visible:outline-1 focus-visible:outline-yellow-300/70 active:translate-y-0 motion-reduce:transform-none"
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-black/25">
            {resource?.imageUrl ? (
              <Image
                src={resource.imageUrl}
                alt=""
                width={34}
                height={34}
                className="max-h-8 max-w-8 object-contain"
              />
            ) : (
              <Sparkles className="h-4 w-4 text-yellow-200/70" aria-hidden="true" />
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-zinc-200">
              {post.title?.trim() || resource?.nameKo || post.resource_id}
            </span>
            <span className="block truncate text-[11px] text-zinc-500">
              {resource?.nameKo ?? post.resource_id} · {post.nickname}
            </span>
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-gray-500">
            {timeAgo(post.created_at, copy, dateLocale)}
          </span>
          {isOwner && (
            <button
              type="button"
              onClick={() => onDelete(post.id)}
              className="text-gray-500 opacity-0 transition-all hover:text-red-400 group-hover:opacity-100 focus-visible:opacity-100"
              title={copy.delete}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="mt-2 text-sm leading-relaxed text-[#f0e6d2]">
        <PostRenderer
          blocks={post.content}
          entityMap={entityMap}
          serviceLocale={serviceLocale}
          gameLocale={gameLocale}
        />
      </div>
    </article>
  );
}
