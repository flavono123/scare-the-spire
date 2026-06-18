import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RichText } from "@/components/rich-text";
import Image from "@/components/ui/static-image";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import {
  getShaNewsEntries,
  SHA_NEWS_ENABLED,
  SHA_NEWS_ICON,
  SHA_NEWS_VERSION,
  type ShaNewsSection,
} from "@/lib/sha-news";
import { serviceMessages } from "@/messages/service";

export function generateShaNewsMetadata(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
): Metadata {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  return serviceMessages[serviceLocale].shaNews.metadata;
}

export function generateMetadata(): Metadata {
  return generateShaNewsMetadata();
}

function ShaNewsSectionList({
  sections,
  notice = false,
}: {
  sections: ShaNewsSection[];
  notice?: boolean;
}) {
  if (sections.length === 0) return null;

  return (
    <div className={notice ? "space-y-3" : "space-y-5"}>
      {sections.map((section) => (
        <section
          key={section.title}
          className={
            notice
              ? "border border-amber-300/35 bg-amber-400/10 px-4 py-3 shadow-[0_0_22px_rgba(251,191,36,0.08)]"
              : undefined
          }
        >
          <h3
            className={
              notice
                ? "text-sm font-black text-amber-100"
                : "text-base font-black text-zinc-100"
            }
          >
            {section.title}
          </h3>
          <ul className="mt-2 space-y-1.5 text-sm leading-6 text-zinc-300">
            {section.bullets.map((bullet) => (
              <li key={bullet} className="flex gap-2">
                <span
                  aria-hidden
                  className={
                    notice
                      ? "mt-2 h-1.5 w-1.5 shrink-0 bg-amber-200"
                      : "mt-2 h-1.5 w-1.5 shrink-0 bg-purple-200/80"
                  }
                />
                <RichText text={bullet} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export async function renderShaNewsPage(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
) {
  if (!SHA_NEWS_ENABLED) notFound();

  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const messages = serviceMessages[serviceLocale].shaNews;
  const entries = await getShaNewsEntries();
  const latestVersion = entries[0]?.date ?? SHA_NEWS_VERSION;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 text-foreground sm:py-10">
      <header className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded border border-purple-200/35 bg-purple-500/10">
          <Image
            src={SHA_NEWS_ICON}
            alt=""
            width={42}
            height={42}
            className="h-[42px] w-[42px] object-contain drop-shadow-[0_3px_8px_rgba(0,0,0,0.55)]"
            priority
          />
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-semibold text-purple-100">
            <span>{messages.eyebrow}</span>
            <span className="rounded border border-purple-200/25 bg-purple-500/10 px-1.5 py-0.5 text-[11px] leading-none text-purple-100/90">
              {latestVersion}
            </span>
          </p>
          <h1 className="text-3xl font-black tracking-tight text-zinc-50">
            {messages.title}
          </h1>
          <p className="mt-1 text-sm leading-6 text-zinc-400">
            {messages.teaserDescription}
          </p>
        </div>
      </header>

      {entries.length === 0 ? (
        <section className="mt-8 border-t border-border/70 pt-6">
          <h2 className="text-lg font-bold text-zinc-100">
            {messages.emptyTitle}
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            {messages.emptyDescription}
          </p>
        </section>
      ) : (
        <div className="mt-8 space-y-8">
          {entries.map((entry) => (
            <article
              key={entry.date}
              className="border-t border-border/70 pt-6 first:border-t-0 first:pt-0"
            >
              <h2 className="text-lg font-black text-zinc-50">{entry.date}</h2>
              {entry.noticeSections.length > 0 && (
                <div className="mt-4">
                  <ShaNewsSectionList sections={entry.noticeSections} notice />
                </div>
              )}
              {entry.regularSections.length > 0 && (
                <div className={entry.noticeSections.length > 0 ? "mt-5" : "mt-4"}>
                  <ShaNewsSectionList sections={entry.regularSections} />
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

export default async function ShaNewsPage() {
  return renderShaNewsPage();
}
