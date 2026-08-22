"use client";

import Link from "next/link";
import { ChevronRight, LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PostRenderer, buildEntityMap } from "@/components/chemicalx/post-renderer";
import { StorageUnavailableNotice } from "@/components/storage-unavailable-notice";
import { SpireLikeIcon } from "@/components/spire-icon";
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
import {
  listOwnContactInquiries,
  type ContactInquiryHistoryItem,
  type ContactInquiryStatus,
} from "@/lib/contact-inquiries";
import { localizeHrefWithGameLocale, type GameLocale, type ServiceLocale } from "@/lib/i18n";
import { buildRichContentIndexes, resolveRichContentBlocks } from "@/lib/rich-content-blocks";
import { supabaseEnabled } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { contactMessages } from "@/messages/contact";

export interface ProfileActivityCopy {
  inquiries: {
    title: string;
    loading: string;
    empty: string;
    responseTitle: string;
    noResponse: string;
    status: Record<ContactInquiryStatus, string>;
    unavailableTitle: string;
  };
  title: string;
  statsTitle: string;
  totalPosts: string;
  totalLikes: string;
  categories: {
    all: string;
    stories: string;
    chemicalX: string;
    thisOrThat: string;
    combo: string;
    comments: string;
    historyCourse: string;
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
  combo: "/images/sts2/badges/ccccombo.webp",
  comments: "/images/sts2/relics/pen_nib.webp",
  history_course: "/images/sts2/relics/history_course.webp",
};

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
  modifier: "modifiers",
  ascension: "ascensions",
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
  if (category === "combo") return copy.categories.combo;
  if (category === "comments") return copy.categories.comments;
  return copy.categories.historyCourse;
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
  if (targetKey.startsWith("c-c-c-combo:")) {
    return `/c-c-c-combo/${encodeURIComponent(targetKey.slice("c-c-c-combo:".length))}#comments`;
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
  else if (item.category === "combo") href = `/c-c-c-combo/${item.targetKey}`;
  else if (item.category === "history_course") href = `/history-course/${item.targetKey}`;
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
  const [inquiryResult, setInquiryResult] = useState<{
    userId: string;
    items: ContactInquiryHistoryItem[];
    unavailable: boolean;
  } | null>(null);
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

  useEffect(() => {
    if (!supabaseEnabled || !ready || !userId) return;

    let cancelled = false;
    listOwnContactInquiries()
      .then((items) => {
        if (cancelled) return;
        setInquiryResult({ userId, items, unavailable: false });
      })
      .catch(() => {
        if (!cancelled) setInquiryResult({ userId, items: [], unavailable: true });
      });

    return () => {
      cancelled = true;
    };
  }, [ready, userId]);

  const activeInquiryResult = inquiryResult?.userId === userId ? inquiryResult : null;
  const inquiries = activeInquiryResult?.items ?? [];
  const inquiriesLoading = Boolean(userId) && !activeInquiryResult;
  const inquiriesUnavailable = !supabaseEnabled || activeInquiryResult?.unavailable === true;

  return (
    <>
      <section
        data-profile-inquiries
        className="border-t border-border py-7 sm:py-9"
      >
        <div className="mb-5 flex items-center gap-3">
          <Image
            src="/images/sts2/relics/tiny_mailbox.webp"
            alt=""
            width={42}
            height={42}
            aria-hidden
            className="h-10 w-10 object-contain drop-shadow-[0_0_8px_rgba(239,200,81,0.28)]"
          />
          <h2 className="font-game-title text-xl font-bold spire-gold sm:text-2xl">
            {copy.inquiries.title}
          </h2>
        </div>

        {!ready || inquiriesLoading ? (
          <div className="flex min-h-28 items-center justify-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle size={17} className="animate-spin" aria-hidden />
            <span>{copy.inquiries.loading}</span>
          </div>
        ) : authUnavailable || inquiriesUnavailable ? (
          <StorageUnavailableNotice
            title={copy.inquiries.unavailableTitle}
            compact
            className="min-h-28"
          />
        ) : inquiries.length === 0 ? (
          <div className="flex min-h-28 items-center justify-center text-sm text-muted-foreground">
            {copy.inquiries.empty}
          </div>
        ) : (
          <div className="space-y-3">
            {inquiries.map((inquiry) => (
              <article
                key={inquiry.id}
                className="rounded-xl border border-border bg-card/40 px-4 py-3.5"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
                  <strong className="text-primary">
                    {contactMessages[serviceLocale].categories[inquiry.category].label}
                  </strong>
                  <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">
                    {copy.inquiries.status[inquiry.status]}
                  </span>
                  <time className="ml-auto text-muted-foreground" dateTime={inquiry.createdAt}>
                    {dateFormatter.format(new Date(inquiry.createdAt))}
                  </time>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                  {inquiry.message}
                </p>
                <div className="mt-3 border-t border-border pt-3">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {copy.inquiries.responseTitle}
                  </p>
                  <p className={cn(
                    "whitespace-pre-wrap break-words text-sm leading-relaxed",
                    inquiry.adminResponse ? "text-foreground" : "text-muted-foreground",
                  )}>
                    {inquiry.adminResponse ?? copy.inquiries.noResponse}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section
        data-profile-activity
        className="border-t border-border pb-16 pt-7 sm:pb-20 sm:pt-9"
      >
      <div className="mb-5 flex items-center gap-3">
        <Image
          src="/images/sts2/relics/storybook.webp"
          alt=""
          width={42}
          height={42}
          aria-hidden
          className="h-10 w-10 object-contain drop-shadow-[0_0_8px_rgba(239,200,81,0.28)]"
        />
        <h2 className="font-game-title text-xl font-bold spire-gold sm:text-2xl">
          {copy.title}
        </h2>
      </div>

      <div aria-labelledby="profile-activity-stats-title">
        <h3
          id="profile-activity-stats-title"
          className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
        >
          {copy.statsTitle}
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-8">
          <StatButton
            active={filter === "all"}
            icon="/images/sts2/relics/pen_nib.webp"
            label={copy.totalPosts}
            value={activity.totals.postCount}
            detail={formatTemplate(copy.categoryLikes, { count: activity.totals.likeCount })}
            onClick={() => setFilter("all")}
          />
          <div className="flex min-h-24 flex-col justify-between rounded-lg border border-primary/25 bg-primary/[0.08] px-3 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <SpireLikeIcon size={20} />
              <span>{copy.totalLikes}</span>
            </div>
            <strong className="text-2xl font-bold tabular-nums text-primary">
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

      <div className="mt-7 flex items-center justify-between gap-3 border-b border-border pb-2">
        <span className="min-w-0 truncate text-sm font-semibold text-foreground">
          {filter === "all" ? copy.categories.all : categoryLabel(filter, copy)}
        </span>
        <div className="flex shrink-0 rounded-md border border-border bg-muted/40 p-0.5">
          {(["latest", "likes"] as const).map((sortOption) => (
            <button
              key={sortOption}
              type="button"
              aria-pressed={sort === sortOption}
              onClick={() => setSort(sortOption)}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-semibold transition-colors",
                sort === sortOption
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {copy.sort[sortOption]}
            </button>
          ))}
        </div>
      </div>

      {!ready || activity.loading ? (
        <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle size={17} className="animate-spin" aria-hidden />
          <span>{copy.loading}</span>
        </div>
      ) : authUnavailable || activity.unavailable ? (
        <StorageUnavailableNotice title={copy.unavailableTitle} compact className="min-h-40" />
      ) : activity.items.length === 0 ? (
        <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
          {copy.empty}
        </div>
      ) : (
        <>
          <div className="divide-y divide-border">
            {activity.items.map((item) => (
              <article
                key={`${item.category}:${item.activityId}`}
                className="group grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-start gap-3 py-3.5 transition-colors hover:bg-muted/40 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:px-2"
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
                  <div className="mb-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="font-semibold text-primary">
                      {categoryLabel(item.category, copy)}
                    </span>
                    <time dateTime={item.createdAt}>{dateFormatter.format(new Date(item.createdAt))}</time>
                  </div>
                  <div className="break-words text-sm leading-relaxed text-foreground">
                    <PostRenderer
                      blocks={resolveRichContentBlocks(item.content, item.contentBlocks, richContentIndexes)}
                      entityMap={entityMap}
                      serviceLocale={serviceLocale}
                      gameLocale={gameLocale}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 pl-1 pt-5 text-muted-foreground">
                  <span className="inline-flex items-center gap-1 text-xs tabular-nums" title={formatTemplate(copy.likes, { count: item.likeCount })}>
                    <SpireLikeIcon size={16} />
                    {item.likeCount}
                  </span>
                  <Link
                    href={activityHref(item, serviceLocale, gameLocale)}
                    prefetch={false}
                    aria-label={copy.open}
                    className="rounded-sm p-0.5 transition-colors hover:text-primary focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary"
                  >
                    <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-5 flex flex-col items-center gap-2">
            <span className="text-xs tabular-nums text-muted-foreground">
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
                className="min-w-32 rounded-md border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/15 disabled:cursor-wait disabled:opacity-60"
              >
                {activity.loadingMore ? copy.loadingMore : copy.loadMore}
              </button>
            )}
          </div>
        </>
      )}
      </section>
    </>
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
          ? "border-primary/40 bg-primary/[0.08]"
          : "border-border bg-card/30 hover:border-primary/25 hover:bg-primary/[0.04]",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Image src={icon} alt="" width={22} height={22} aria-hidden className="h-5 w-5 shrink-0 object-contain" />
        <span className="truncate text-xs font-semibold text-muted-foreground">{label}</span>
      </div>
      <div>
        <strong className="block text-2xl font-bold tabular-nums text-foreground">
          {value.toLocaleString()}
        </strong>
        <span className="text-[11px] text-muted-foreground">{detail}</span>
      </div>
    </button>
  );
}
