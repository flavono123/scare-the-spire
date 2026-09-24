"use client";

import Image from "@/components/ui/static-image";
import { useRouter } from "next/navigation";
import { useMemo, type KeyboardEvent, type MouseEvent } from "react";
import { ContentLoadingNotice } from "@/components/content-loading-notice";
import { StorageUnavailableNotice } from "@/components/storage-unavailable-notice";
import { ToyBoxIndexHeading } from "@/components/toybox-index-heading";
import { ColorfulPhilosopherIndexEngagement } from "@/components/colorful-philosophers/index-engagement";
import { ColorfulPhilosopherSubjectArt } from "@/components/colorful-philosophers/subject-art";
import {
  useColorfulPhilosopherCommentCounts,
  useColorfulPhilosopherWeek,
} from "@/hooks/use-colorful-philosopher-posts";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { localizeHref } from "@/lib/i18n";
import {
  COLORFUL_PHILOSOPHER_SLOTS,
  COLORFUL_PHILOSOPHERS_HREF,
  COLORFUL_PHILOSOPHERS_TOKEN_SRC,
  addColorfulPhilosophersDays,
  colorfulPhilosophersWeekStart,
  type ColorfulPhilosopherPost,
} from "@/lib/colorful-philosophers";
import { serviceMessages } from "@/messages/service";

export function ColorfulPhilosophersIndex({
  title,
  subtitle,
  hero,
}: {
  title: string;
  subtitle: string;
  hero: string;
}) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].colorfulPhilosophers;
  const { posts, loading, unavailable, missing } = useColorfulPhilosopherWeek();
  const currentWeek = colorfulPhilosophersWeekStart();
  const visiblePosts = useMemo(
    () => posts.filter((post) => post.weekStart <= currentWeek),
    [posts, currentWeek],
  );
  const postIds = useMemo(() => visiblePosts.map((post) => post.id), [visiblePosts]);
  const commentCounts = useColorfulPhilosopherCommentCounts(postIds);
  const weekStarts = Array.from(new Set([
    currentWeek,
    ...visiblePosts.map((post) => post.weekStart),
  ])).sort((left, right) => right.localeCompare(left));

  return (
    <div className="space-y-6" data-colorful-philosophers-page="index">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <Image src={COLORFUL_PHILOSOPHERS_TOKEN_SRC} alt={title} width={32} height={32} className="object-contain" />
          <h1 className="font-service text-xl font-bold text-primary">{title}</h1>
        </div>
        <ToyBoxIndexHeading subtitle={subtitle} hero={hero} />
      </header>
      {loading ? <ContentLoadingNotice label={copy.loading} /> : null}
      {unavailable ? <StorageUnavailableNotice title={copy.unavailableTitle} /> : null}
      {!loading && !unavailable ? (
        <div className="space-y-8">
          {weekStarts.map((weekStart) => {
            const weekPosts = visiblePosts.filter((post) => post.weekStart === weekStart);
            const bySlot = new Map(weekPosts.map((post) => [post.slot, post]));
            const slots = weekStart === currentWeek
              ? COLORFUL_PHILOSOPHER_SLOTS
              : COLORFUL_PHILOSOPHER_SLOTS.filter((slot) => bySlot.has(slot));
            return (
              <section key={weekStart} className="space-y-3">
                <h2 className="font-service text-sm text-zinc-300">
                  {`${weekStart.slice(5)} – ${addColorfulPhilosophersDays(weekStart, 6).slice(5)}`}
                </h2>
                {slots.map((slot) => {
                  const post = bySlot.get(slot);
                  if (!post || missing) {
                    return (
                      <div key={slot} className="rounded-xl border border-white/10 bg-black/35 px-4 py-5">
                        <p className="font-service text-xs text-zinc-500">{copy.slots[slot]}</p>
                        <p className="mt-2 text-sm text-zinc-400">{copy.emptySlot}</p>
                      </div>
                    );
                  }
                  return (
                    <WeekPostCard
                      key={slot}
                      post={post}
                      slotLabel={copy.slots[slot]}
                      commentCount={commentCounts[post.id] ?? 0}
                    />
                  );
                })}
              </section>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function WeekPostCard({
  post,
  slotLabel,
  commentCount,
}: {
  post: ColorfulPhilosopherPost;
  slotLabel: string;
  commentCount: number;
}) {
  const serviceLocale = useServiceLocale();
  const router = useRouter();
  const href = localizeHref(`${COLORFUL_PHILOSOPHERS_HREF}/${post.id}`, serviceLocale);
  const openPost = () => router.push(href);
  const handleClick = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("a, button")) return;
    openPost();
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openPost();
  };

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="group cursor-pointer rounded-xl border border-white/10 bg-black/35 px-4 py-4 transition-colors hover:border-primary/20 focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary/70"
    >
      <div className="flex items-center gap-4">
        <ColorfulPhilosopherSubjectArt post={post} serviceLocale={serviceLocale} width={96} />
        <span className="min-w-0 flex-1">
          <span className="block font-service text-xs text-zinc-500">{slotLabel}</span>
          <span className="block truncate font-service text-lg font-semibold text-primary">{post.nameKo}</span>
          <span className="mt-1 line-clamp-2 block text-sm text-zinc-300">{post.body}</span>
        </span>
        <ColorfulPhilosopherIndexEngagement
          post={post}
          commentsHref={`${href}#comments`}
          commentCount={commentCount}
        />
      </div>
    </article>
  );
}
