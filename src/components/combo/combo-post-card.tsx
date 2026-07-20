"use client";

import Link from "next/link";
import { ExternalLink, Trash2 } from "lucide-react";
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

  return (
    <article className="group rounded-lg border border-border bg-card/30 px-4 py-3 transition-colors hover:border-yellow-500/20">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-300">{post.nickname}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {timeAgo(post.created_at, copy, dateLocale)}
          </span>
          <Link
            href={localizeHrefWithGameLocale(`/combo/${post.id}`, serviceLocale, gameLocale)}
            prefetch={false}
            className="text-gray-500 opacity-0 transition-all hover:text-yellow-400 group-hover:opacity-100 focus-visible:opacity-100"
            title={copy.share}
          >
            <ExternalLink size={14} />
          </Link>
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
        variant="index"
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
