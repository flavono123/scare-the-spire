"use client";

import { useCallback, type KeyboardEvent, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Sparkles, Trash2 } from "lucide-react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { PostRenderer } from "@/components/chemicalx/post-renderer";
import { TransfigureResourcePreview } from "@/components/transfigure/transfigure-resource-preview";
import {
  localizeHrefWithGameLocale,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import type { TransfigurePost } from "@/lib/transfigure-types";
import { serviceMessages } from "@/messages/service";

interface TransfigurePostCardProps {
  post: TransfigurePost;
  entities: EntityInfo[];
  entityMap: Map<string, EntityInfo>;
  isOwner: boolean;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  upgradeLabel: string;
  onEdit: (post: TransfigurePost) => void;
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
  entities,
  entityMap,
  isOwner,
  serviceLocale,
  gameLocale,
  upgradeLabel,
  onEdit,
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
      className="group flex h-full cursor-pointer flex-col rounded-lg border border-border bg-card/25 px-4 py-4 transition-[transform,border-color,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-yellow-500/25 hover:bg-card/35 hover:shadow-lg hover:shadow-black/25 focus-visible:outline focus-visible:outline-1 focus-visible:outline-yellow-300/70 active:translate-y-0 motion-reduce:transform-none"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-2 font-game-title text-base font-semibold leading-snug spire-gold">
            {post.title?.trim() || resource?.nameKo || post.resource_id}
          </h2>
          <span className="mt-1 block text-xs text-muted-foreground">
            {timeAgo(post.created_at, copy, dateLocale)}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isOwner && (
            <>
              <button
                type="button"
                onClick={() => onEdit(post)}
                className="text-muted-foreground opacity-80 transition-colors hover:text-yellow-300 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
                title={copy.edit}
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                onClick={() => onDelete(post.id)}
                className="text-muted-foreground opacity-80 transition-colors hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
                title={copy.delete}
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      <div
        className="flex min-h-[24rem] flex-1 items-center justify-center overflow-hidden rounded-md bg-black/15 px-2 py-3 sm:min-h-[28rem]"
        data-transfigure-post-asset
      >
        {resource ? (
          <TransfigureResourcePreview
            blocks={post.content}
            entities={entities}
            entityMap={entityMap}
            entity={resource}
            gameLocale={gameLocale}
            serviceLocale={serviceLocale}
            transformedName={post.transformed_name}
            transformedCost={post.transformed_cost}
            cardKeywords={{
              top: post.card_top_keywords,
              bottom: post.card_bottom_keywords,
            }}
            transformedUpgradeCost={post.transformed_upgrade_cost}
            upgradedBlocks={post.upgraded_content}
            upgradedCardKeywords={{
              top: post.upgraded_card_top_keywords,
              bottom: post.upgraded_card_bottom_keywords,
            }}
            upgradeLabel={upgradeLabel}
            initialShowUpgrade={post.show_upgrade}
            showImageActions={false}
            showUpgradeToggle={false}
          />
        ) : (
          <div className="flex max-w-full flex-col items-center gap-3 text-sm leading-relaxed text-[#f0e6d2]">
            <Sparkles className="h-8 w-8 text-yellow-200/70" aria-hidden="true" />
            <PostRenderer
              blocks={post.show_upgrade && post.upgraded_content
                ? post.upgraded_content
                : post.content}
              entityMap={entityMap}
              serviceLocale={serviceLocale}
              gameLocale={gameLocale}
            />
          </div>
        )}
      </div>

      <div className="mt-auto flex justify-end pt-2">
        <span className="max-w-[70%] truncate text-[11px] text-muted-foreground/80">
          {post.nickname}
        </span>
      </div>
    </article>
  );
}
