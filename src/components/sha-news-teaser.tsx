import Image from "@/components/ui/static-image";
import Link from "next/link";
import {
  localizeHrefWithGameLocale,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import { serviceMessages } from "@/messages/service";

export function ShaNewsTeaser({
  serviceLocale,
  gameLocale,
}: {
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
}) {
  const messages = serviceMessages[serviceLocale].shaNews;

  return (
    <Link
      href={localizeHrefWithGameLocale("/sha-news", serviceLocale, gameLocale)}
      className="group flex min-h-14 items-center gap-3 border border-border/70 bg-card/20 px-3 py-2 transition-colors hover:border-purple-300/40 hover:bg-purple-500/10 sm:rounded-lg sm:px-4"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-black/20">
        <Image
          src="/images/sts2/monsters-render/byrdonis.webp"
          alt=""
          width={46}
          height={46}
          className="h-11 w-11 object-contain object-bottom drop-shadow-[0_2px_5px_rgba(0,0,0,0.55)] transition-transform group-hover:scale-105"
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold text-purple-200/80">
          {messages.eyebrow}
        </span>
        <span className="block truncate text-sm font-bold text-zinc-100 sm:text-base">
          {messages.title}
          <span className="ml-2 font-medium text-zinc-400">
            {messages.teaserTitle}
          </span>
        </span>
      </span>
      <span className="shrink-0 text-xs font-semibold text-purple-200 transition-colors group-hover:text-purple-100">
        {messages.viewAll}
      </span>
    </Link>
  );
}
