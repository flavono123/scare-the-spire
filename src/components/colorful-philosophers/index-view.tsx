"use client";

import Image from "@/components/ui/static-image";
import Link from "next/link";
import { ContentLoadingNotice } from "@/components/content-loading-notice";
import { StorageUnavailableNotice } from "@/components/storage-unavailable-notice";
import { ToyBoxIndexHeading } from "@/components/toybox-index-heading";
import { ColorfulPhilosopherSubjectArt } from "@/components/colorful-philosophers/subject-art";
import { useColorfulPhilosopherWeek } from "@/hooks/use-colorful-philosopher-posts";
import { useServiceLocale } from "@/hooks/use-service-locale";
import {
  COLORFUL_PHILOSOPHER_SLOTS,
  COLORFUL_PHILOSOPHERS_HREF,
  COLORFUL_PHILOSOPHERS_TOKEN_SRC,
  addColorfulPhilosophersDays,
  colorfulPhilosophersWeekStart,
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
  const visiblePosts = posts.filter((post) => post.weekStart <= currentWeek);
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
                    <Link
                      key={slot}
                      href={`${COLORFUL_PHILOSOPHERS_HREF}/${post.id}`}
                      className="flex items-center gap-4 rounded-xl border border-white/10 bg-black/35 px-4 py-4"
                    >
                      <ColorfulPhilosopherSubjectArt post={post} serviceLocale={serviceLocale} width={96} />
                      <span className="min-w-0">
                        <span className="block font-service text-xs text-zinc-500">{copy.slots[slot]}</span>
                        <span className="block truncate font-service text-lg font-semibold text-primary">{post.nameKo}</span>
                        <span className="mt-1 line-clamp-2 block text-sm text-zinc-300">{post.body}</span>
                      </span>
                    </Link>
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
