"use client";

import Image from "@/components/ui/static-image";
import Link from "next/link";
import { ContentLoadingNotice } from "@/components/content-loading-notice";
import { StorageUnavailableNotice } from "@/components/storage-unavailable-notice";
import { ToyBoxIndexHeading } from "@/components/toybox-index-heading";
import { useColorfulPhilosopherWeek } from "@/hooks/use-colorful-philosopher-posts";
import { useServiceLocale } from "@/hooks/use-service-locale";
import {
  COLORFUL_PHILOSOPHER_SLOTS,
  COLORFUL_PHILOSOPHERS_HREF,
  COLORFUL_PHILOSOPHERS_TOKEN_SRC,
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
  const bySlot = new Map(posts.map((post) => [post.slot, post]));

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
        <div className="space-y-3">
          {COLORFUL_PHILOSOPHER_SLOTS.map((slot) => {
            const post = bySlot.get(slot);
            if (!post || missing) {
              return (
                <section key={slot} className="rounded-xl border border-white/10 bg-black/35 px-4 py-5">
                  <p className="font-service text-xs text-zinc-500">{copy.slots[slot]}</p>
                  <p className="mt-2 text-sm text-zinc-400">{copy.emptySlot}</p>
                </section>
              );
            }
            return (
              <Link
                key={slot}
                href={`${COLORFUL_PHILOSOPHERS_HREF}/${post.id}`}
                className="flex gap-4 rounded-xl border border-white/10 bg-black/35 px-4 py-4"
              >
                <Image
                  src={post.imageUrl ?? COLORFUL_PHILOSOPHERS_TOKEN_SRC}
                  alt=""
                  width={56}
                  height={56}
                  className="object-contain"
                />
                <span className="min-w-0">
                  <span className="block font-service text-xs text-zinc-500">{copy.slots[slot]}</span>
                  <span className="block truncate font-service text-lg font-semibold text-primary">{post.nameKo}</span>
                  <span className="mt-1 line-clamp-2 block text-sm text-zinc-300">{post.body}</span>
                </span>
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
