import Image from "@/components/ui/static-image";
import Link from "next/link";
import {
  localizeHrefWithGameLocale,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import { BYRDISPATCH_ICON } from "@/lib/byrdispatch";
import { serviceMessages } from "@/messages/service";

export function ByrdispatchTeaser({
  serviceLocale,
  gameLocale,
  latestDate,
}: {
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  latestDate?: string;
}) {
  const messages = serviceMessages[serviceLocale].byrdispatch;

  return (
    <Link
      href={localizeHrefWithGameLocale("/byrdispatch", serviceLocale, gameLocale)}
      className="group flex min-h-14 items-center gap-3 border border-purple-300/35 bg-purple-500/10 px-3 py-2 transition-colors hover:border-purple-200/70 hover:bg-purple-500/15 sm:rounded-lg sm:px-4"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-purple-200/30 bg-black/30 shadow-[0_0_0_1px_rgba(216,180,254,0.12)]">
        <Image
          src={BYRDISPATCH_ICON}
          alt=""
          width={28}
          height={28}
          className="h-7 w-7 object-contain drop-shadow-[0_2px_5px_rgba(0,0,0,0.55)] transition-transform group-hover:scale-105"
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-zinc-100 sm:text-base">
          {messages.title}
        </span>
        {latestDate && (
          <span className="mt-0.5 block truncate text-xs font-semibold text-purple-200/80">
            {messages.latestDate.replace("{date}", latestDate)}
          </span>
        )}
      </span>
      <span className="shrink-0 text-xs font-semibold text-purple-200 transition-colors group-hover:text-purple-100">
        {messages.viewAll}
      </span>
    </Link>
  );
}
