"use client";

import { useCallback, type KeyboardEvent, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import type { ComboPost } from "@/lib/combo-types";
import {
  localizeHrefWithGameLocale,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import { serviceMessages } from "@/messages/service";
import { ComboPostRenderer } from "./combo-post-renderer";
import { ComboResourceStack } from "./combo-resource-stack";

interface ComboPostCardProps {
  post: ComboPost;
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

export function ComboPostCard({
  post,
  entityMap,
  isOwner,
  serviceLocale,
  gameLocale,
  onDelete,
}: ComboPostCardProps) {
  const copy = serviceMessages[serviceLocale].combo;
  const dateLocale = serviceLocale === "ko" ? "ko-KR" : "en-US";
  const router = useRouter();
  const href = localizeHrefWithGameLocale(`/combo/${post.id}`, serviceLocale, gameLocale);
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
      className="group cursor-pointer rounded-lg border border-border bg-card/30 px-4 py-3 transition-[transform,border-color,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-yellow-500/30 hover:bg-card/40 hover:shadow-lg hover:shadow-black/25 focus-visible:outline focus-visible:outline-1 focus-visible:outline-yellow-400/70 active:translate-y-0 motion-reduce:transform-none"
    >
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-300">{post.nickname}</span>
        <div className="flex items-center gap-2">
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

      <ComboResourceStack
        resources={post.resources}
        entityMap={entityMap}
        serviceLocale={serviceLocale}
        gameLocale={gameLocale}
      />

      <div className="text-sm leading-relaxed">
        <ComboPostRenderer
          blocks={post.content}
          entityMap={entityMap}
          serviceLocale={serviceLocale}
          gameLocale={gameLocale}
        />
      </div>
    </article>
  );
}
