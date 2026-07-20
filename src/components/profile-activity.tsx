"use client";

import Link from "next/link";
import { ChevronRight, LoaderCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { PostRenderer, buildEntityMap } from "@/components/chemicalx/post-renderer";
import { StorageUnavailableNotice } from "@/components/storage-unavailable-notice";
import Image from "@/components/ui/static-image";
import { useAuth } from "@/hooks/use-auth";
import { useCommentEntities } from "@/hooks/use-comment-entities";
import {
  PROFILE_ACTIVITY_CATEGORIES,
  type ProfileActivityCategory,
  type ProfileActivityFilter,
  type ProfileActivityItem,
  type ProfileActivitySort,
  useProfileActivity,
} from "@/hooks/use-profile-activity";
import { localizeHrefWithGameLocale, type GameLocale, type ServiceLocale } from "@/lib/i18n";
import { buildRichContentIndexes, resolveRichContentBlocks } from "@/lib/rich-content-blocks";
import { cn } from "@/lib/utils";

export interface ProfileActivityCopy {
  title: string;
  statsTitle: string;
  totalPosts: string;
  totalLikes: string;
  categories: {
    all: string;
    stories: string;
    chemicalX: string;
    thisOrThat: string;
    comments: string;
  };
  sort: {
    latest: string;
    likes: string;
  };
  likes: string;
  categoryLikes: string;
  loading: string;
  empty: string;
  loadMore: string;
  loadingMore: string;
  progress: string;
  open: string;
  unavailableTitle: string;
}

const CATEGORY_ICON: Record<ProfileActivityCategory, string> = {
  stories: "/images/sts2/relics/bone_tea.webp",
  chemical_x: "/images/sts2/relics/chemical_x.webp",
  this_or_that: "/images/sts2/relics/choices_paradox.webp",
  comments: "/images/sts2/relics/pen_nib.webp",
};

const LIKE_ICON = "/images/sts2/ui/emote/thumb_up.png";

const CODEX_PATHS: Record<string, string> = {
  affliction: "enchantments",
  ancient: "ancients",
  card: "cards",
  character: "characters",
  encounter: "encounters",
  enchantment: "enchantments",
  epoch: "epochs",
  event: "events",
  keyword: "keywords",
  monster: "monsters",
  potion: "potions",
  power: "powers",
  relic: "relics",
};

function formatTemplate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, String(value)),
    template,
  );
}

function categoryLabel(category: ProfileActivityCategory, copy: ProfileActivityCopy): string {
  if (category === "stories") return copy.categories.stories;
  if (category === "chemical_x") return copy.categories.chemicalX;
  if (category === "this_or_that") return copy.categories.thisOrThat;
  return copy.categories.comments;
}

function commentTargetHref(targetKey: string): string {
  if (targetKey.startsWith("sts2-patch:")) {
    return `/patches/${encodeURIComponent(targetKey.slice("sts2-patch:".length))}#comments`;
  }

  const codexMatch = /^sts2-codex:([^:]+):(.+)$/.exec(targetKey);
  if (codexMatch) {
    const [, type, id] = codexMatch;
    const path = CODEX_PATHS[type];
    if (path) return `/compendium/${path}/${encodeURIComponent(id.toLowerCase())}#comments`;
  }

  if (targetKey.startsWith("this-or-that:")) {
    return `/this-or-that/${encodeURIComponent(targetKey.slice("this-or-that:".length))}#comments`;
  }
  if (targetKey === "byrdispatch") return "/byrdispatch#comments";
  return `/#${targetKey}`;
}

function activityHref(
  item: ProfileActivityItem,
  serviceLocale: ServiceLocale,
  gameLocale: GameLocale,
): string {
  let href: string;
  if (item.category === "stories") href = `/#${item.targetKey}`;
  else if (item.category === "chemical_x") href = `/chemical-x/${item.targetKey}`;
  else if (item.category === "this_or_that") href = `/this-or-that/${item.targetKey}`;
  else href = commentTargetHref(item.targetKey);
  return localizeHrefWithGameLocale(href, serviceLocale, gameLocale);
}

export function ProfileActivity({
  copy,
  serviceLocale,
  gameLocale,
}: {
  copy: ProfileActivityCopy;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
}) {
  const { userId, ready, unavailable: authUnavailable } = useAuth();
  const [filter, setFilter] = useState<ProfileActivityFilter>("all");
  const [sort, setSort] = useState<ProfileActivitySort>("latest");
  const activity = useProfileActivity(userId, filter, sort);
  const { entities } = useCommentEntities(undefined, { enabled: activity.items.length > 0 });
  const entityMap = useMemo(() => buildEntityMap(entities), [entities]);
  const richContentIndexes = useMemo(() => buildRichContentIndexes(entities), [entities]);
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(serviceLocale === "ko" ? "ko-KR" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
    [serviceLocale],
  );

  return (
    <section
      data-profile-activity
      className="border-t border-white/10 pb-16 pt-7 sm:pb-20 sm:pt-9"
    >
      <div className="mb-5 flex items-center gap-3">
        <Image
          src="/images/sts2/relics/storybook.webp"
          alt=""
          width={42}
          height={42}
          aria-hidden
          className="h-10 w-10 object-contain drop-shadow-[0_0_8px_rgba(250,204,21,0.28)]"
        />
        <h2 className="font-game-title text-xl font-bold spire-gold sm:text-2xl">
          {copy.title}
        </h2>
      </div>

      <div aria-labelledby="profile-activity-stats-title">
        <h3
          id="profile-activity-stats-title"
          className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500"
        >
          {copy.statsTitle}
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <StatButton
            active={filter === "all"}
            icon="/images/sts2/relics/pen_nib.webp"
            label={copy.totalPosts}
            value={activity.totals.postCount}
            detail={formatTemplate(copy.categoryLikes, { count: activity.totals.likeCount })}
            onClick={() => setFilter("all")}
          />
          <div className="flex min-h-24 flex-col justify-between rounded-lg border border-amber-300/15 bg-amber-400/[0.035] px-3 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400">
              <Image src={LIKE_ICON} alt="" width={20} height={20} aria-hidden className="h-5 w-5 object-contain" />
              <span>{copy.totalLikes}</span>
            </div>
            <strong className="text-2xl font-bold tabular-nums text-amber-100">
              {activity.totals.likeCount.toLocaleString()}
            </strong>
          </div>
          {PROFILE_ACTIVITY_CATEGORIES.map((category) => (
            <StatButton
              key={category}
              active={filter === category}
              icon={CATEGORY_ICON[category]}
              label={categoryLabel(category, copy)}
              value={activity.stats[category].postCount}
              detail={formatTemplate(copy.categoryLikes, { count: activity.stats[category].likeCount })}
              onClick={() => setFilter(category)}
            />
          ))}
        </div>
      </div>

      <div className="mt-7 flex items-center justify-between gap-3 border-b border-white/10 pb-2">
        <span className="min-w-0 truncate text-sm font-semibold text-zinc-200">
          {filter === "all" ? copy.categories.all : categoryLabel(filter, copy)}
        </span>
        <div className="flex shrink-0 rounded-md border border-white/10 bg-black/20 p-0.5">
          {(["latest", "likes"] as const).map((sortOption) => (
            <button
              key={sortOption}
              type="button"
              aria-pressed={sort === sortOption}
              onClick={() => setSort(sortOption)}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-semibold transition-colors",
                sort === sortOption
                  ? "bg-amber-300/15 text-amber-100"
                  : "text-zinc-500 hover:text-zinc-200",
              )}
            >
              {copy.sort[sortOption]}
            </button>
          ))}
        </div>
      </div>

      {!ready || activity.loading ? (
        <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-zinc-500">
          <LoaderCircle size={17} className="animate-spin" aria-hidden />
          <span>{copy.loading}</span>
        </div>
      ) : authUnavailable || activity.unavailable ? (
        <StorageUnavailableNotice title={copy.unavailableTitle} compact className="min-h-40" />
      ) : activity.items.length === 0 ? (
        <div className="flex min-h-40 items-center justify-center text-sm text-zinc-500">
          {copy.empty}
        </div>
      ) : (
        <>
          <div className="divide-y divide-white/[0.07]">
            {activity.items.map((item) => (
              <article
                key={`${item.category}:${item.activityId}`}
                className="group grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-start gap-3 py-3.5 transition-colors hover:bg-white/[0.025] sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:px-2"
              >
                <Image
                  src={CATEGORY_ICON[item.category]}
                  alt=""
                  width={36}
                  height={36}
                  aria-hidden
                  className="h-9 w-9 object-contain opacity-90"
                />
                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-2 text-[11px] text-zinc-500">
                    <span className="font-semibold text-amber-200/75">
                      {categoryLabel(item.category, copy)}
                    </span>
                    <time dateTime={item.createdAt}>{dateFormatter.format(new Date(item.createdAt))}</time>
                  </div>
                  <div className="break-words text-sm leading-relaxed text-zinc-200 group-hover:text-amber-50">
                    <PostRenderer
                      blocks={resolveRichContentBlocks(item.content, item.contentBlocks, richContentIndexes)}
                      entityMap={entityMap}
                      serviceLocale={serviceLocale}
                      gameLocale={gameLocale}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 pl-1 pt-5 text-zinc-500">
                  <span className="inline-flex items-center gap-1 text-xs tabular-nums" title={formatTemplate(copy.likes, { count: item.likeCount })}>
                    <Image src={LIKE_ICON} alt="" width={16} height={16} aria-hidden className="h-4 w-4 object-contain opacity-80" />
                    {item.likeCount}
                  </span>
                  <Link
                    href={activityHref(item, serviceLocale, gameLocale)}
                    prefetch={false}
                    aria-label={copy.open}
                    className="rounded-sm p-0.5 transition-colors hover:text-amber-200 focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-300"
                  >
                    <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-5 flex flex-col items-center gap-2">
            <span className="text-xs tabular-nums text-zinc-600">
              {formatTemplate(copy.progress, {
                shown: activity.items.length.toLocaleString(),
                total: activity.totalCount.toLocaleString(),
              })}
            </span>
            {activity.items.length < activity.totalCount && (
              <button
                type="button"
                disabled={activity.loadingMore}
                onClick={() => void activity.loadMore()}
                className="min-w-32 rounded-md border border-amber-300/25 bg-amber-300/[0.07] px-4 py-2 text-sm font-semibold text-amber-100 transition-colors hover:bg-amber-300/15 disabled:cursor-wait disabled:opacity-60"
              >
                {activity.loadingMore ? copy.loadingMore : copy.loadMore}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function StatButton({
  active,
  icon,
  label,
  value,
  detail,
  onClick,
}: {
  active: boolean;
  icon: string;
  label: string;
  value: number;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex min-h-24 flex-col justify-between rounded-lg border px-3 py-3 text-left transition-colors",
        active
          ? "border-amber-300/40 bg-amber-300/[0.08]"
          : "border-white/10 bg-white/[0.02] hover:border-amber-300/25 hover:bg-amber-300/[0.04]",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Image src={icon} alt="" width={22} height={22} aria-hidden className="h-5 w-5 shrink-0 object-contain" />
        <span className="truncate text-xs font-semibold text-zinc-400">{label}</span>
      </div>
      <div>
        <strong className="block text-2xl font-bold tabular-nums text-zinc-100">
          {value.toLocaleString()}
        </strong>
        <span className="text-[11px] text-zinc-600">{detail}</span>
      </div>
    </button>
  );
}
