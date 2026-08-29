"use client";

import Link from "next/link";
import Image from "@/components/ui/static-image";
import { FAVORITE_TOURNAMENT_HREF, FAVORITE_TOURNAMENT_TOKEN_SRC } from "@/lib/favorite-tournament";
import { localizeHrefWithGameLocale, type GameLocale, type ServiceLocale } from "@/lib/i18n";
import { serviceMessages } from "@/messages/service";

const THIS_OR_THAT_TOKEN = "/images/sts2/relics/choices_paradox.webp";

export function ThisOrThatServiceTabs({
  active,
  serviceLocale,
  gameLocale,
}: {
  active: "this-or-that" | "tournament";
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
}) {
  const copy = serviceMessages[serviceLocale].favoriteTournament;
  const items = [
    {
      id: "this-or-that" as const,
      label: copy.tabThisOrThat,
      href: "/this-or-that",
      icon: THIS_OR_THAT_TOKEN,
    },
    {
      id: "tournament" as const,
      label: copy.tabWorldCup,
      href: FAVORITE_TOURNAMENT_HREF,
      icon: FAVORITE_TOURNAMENT_TOKEN_SRC,
    },
  ];

  return (
    <nav
      className="mt-4 flex items-center gap-5 border-b border-border"
      aria-label={copy.tabsLabel}
    >
      {items.map((item) => {
        const selected = item.id === active;
        return (
          <Link
            key={item.id}
            href={localizeHrefWithGameLocale(item.href, serviceLocale, gameLocale)}
            prefetch={false}
            aria-current={selected ? "page" : undefined}
            className={`relative inline-flex items-center gap-2 pb-2.5 font-game-title text-sm transition-colors ${
              selected
                ? "font-semibold text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Image src={item.icon} alt="" width={24} height={24} className="h-6 w-6 object-contain" />
            <span>{item.label}</span>
            {selected && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" />}
          </Link>
        );
      })}
    </nav>
  );
}
