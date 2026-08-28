"use client";

import Link from "next/link";
import Image from "@/components/ui/static-image";
import { FAVORITE_TOURNAMENT_HREF, FAVORITE_TOURNAMENT_TOKEN_SRC } from "@/lib/favorite-tournament";
import { localizeHrefWithGameLocale, type GameLocale, type ServiceLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { serviceMessages } from "@/messages/service";

const THIS_OR_THAT_TOKEN = "/images/sts2/relics/choices_paradox.webp";

export function ThisOrThatServiceTabs({
  active,
  serviceLocale,
  gameLocale,
}: {
  active: "this-or-that" | "worldcup";
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
}) {
  const copy = serviceMessages[serviceLocale].favoriteTournament;
  const totHref = localizeHrefWithGameLocale("/this-or-that", serviceLocale, gameLocale);
  const cupHref = localizeHrefWithGameLocale(FAVORITE_TOURNAMENT_HREF, serviceLocale, gameLocale);

  return (
    <nav
      aria-label={copy.tabWorldCup}
      className="flex flex-wrap gap-1 rounded-lg border border-border/70 bg-background/40 p-1"
    >
      <Link
        href={totHref}
        aria-current={active === "this-or-that" ? "page" : undefined}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors",
          active === "this-or-that"
            ? "bg-white/10 text-foreground"
            : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
        )}
      >
        <Image src={THIS_OR_THAT_TOKEN} alt="" width={16} height={16} className="h-4 w-4 object-contain" />
        {copy.tabThisOrThat}
      </Link>
      <Link
        href={cupHref}
        aria-current={active === "worldcup" ? "page" : undefined}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors",
          active === "worldcup"
            ? "bg-white/10 text-foreground"
            : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
        )}
      >
        <Image
          src={FAVORITE_TOURNAMENT_TOKEN_SRC}
          alt=""
          width={16}
          height={16}
          className="h-4 w-4 object-contain"
        />
        {copy.tabWorldCup}
      </Link>
    </nav>
  );
}
