import type { Metadata } from "next";
import Image from "@/components/ui/static-image";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
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

export function renderShaNewsPage(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
) {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const messages = serviceMessages[serviceLocale].shaNews;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 text-foreground sm:py-10">
      <header className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded border border-purple-300/25 bg-purple-500/10">
          <Image
            src="/images/sts2/monsters-render/byrdonis.webp"
            alt=""
            width={72}
            height={72}
            className="h-[72px] w-[72px] object-contain object-bottom drop-shadow-[0_3px_8px_rgba(0,0,0,0.55)]"
            priority
          />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-purple-200/80">
            {messages.eyebrow}
          </p>
          <h1 className="text-3xl font-black tracking-tight text-zinc-50">
            {messages.title}
          </h1>
          <p className="mt-1 text-sm leading-6 text-zinc-400">
            {messages.teaserDescription}
          </p>
        </div>
      </header>

      <section className="mt-8 border-t border-border/70 pt-6">
        <h2 className="text-lg font-bold text-zinc-100">
          {messages.emptyTitle}
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          {messages.emptyDescription}
        </p>
      </section>
    </main>
  );
}

export default function ShaNewsPage() {
  return renderShaNewsPage();
}
