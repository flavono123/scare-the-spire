import type { Metadata } from "next";
import Link from "next/link";
import { IndexPageHeader } from "@/components/place-index/index-page-header";
import Image from "@/components/ui/static-image";
import { foldLast } from "@/components/place-index/place-tiles";
import { getServiceLocaleForGameLocale, localizeHrefWithGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { PLACE_AREAS, PLACE_AREA_META, placeIsNew, placeLabel, placesInArea } from "@/lib/place-registry";
import { getServiceOgMetadata } from "@/lib/service-metadata";
import { TOYBOX_WIDE_SHELL_CLASS } from "@/lib/toybox-layout";
import { contactMessages } from "@/messages/contact";
import { serviceMessages } from "@/messages/service";

export const MENU_HREF = "/menu";

export function generateMenuMetadata(gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE): Metadata {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const copy = serviceMessages[serviceLocale].placeIndex;
  return getServiceOgMetadata({
    serviceLocale,
    title: copy.menuTitle,
    description: copy.menuDescription,
    canonicalPath: MENU_HREF,
  });
}

/** Every menu destination as plain links; also the no-JavaScript menu. */
export function renderMenuPage(gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE) {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const copy = serviceMessages[serviceLocale].placeIndex;
  const local = (href: string) => localizeHrefWithGameLocale(href, serviceLocale, gameLocale);
  const sections = PLACE_AREAS.map((area) => ({
    area,
    title: copy.areas[area],
    href: PLACE_AREA_META[area].href,
    token: PLACE_AREA_META[area].token,
    links: foldLast(placesInArea(area).filter((place) => place.kind !== "hub" && !place.menuHidden)),
  }));
  const account = [
    { href: "/profile", label: copy.profile, token: "/images/sts2/profile/unset.webp" },
    { href: "/contact", label: contactMessages[serviceLocale].navLabel, token: "/images/sts2/relics/tiny_mailbox.webp" },
  ];

  return (
    <div className="relative isolate min-h-[calc(100svh-3rem)]">
      <div className={TOYBOX_WIDE_SHELL_CLASS}>
        <IndexPageHeader
          title={copy.menuTitle}
          token="/images/sts2/ui/topbar/top_bar_map.png"
          art={PLACE_AREA_META.toybox.art}
          homeHref={local("/")}
          backLabel={copy.backHome}
        />
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((section) => (
            <section key={section.area}>
              <h2>
                <Link href={local(section.href)} prefetch={false} className="flex items-center gap-2 font-game-title text-lg text-primary hover:text-primary/80">
                  <Image src={section.token} alt="" width={28} height={28} className="h-6 w-6 object-contain" />
                  {section.title}
                </Link>
              </h2>
              <ul className="mt-2 space-y-0.5">
                {section.links.map((place) => (
                  <li key={place.id}>
                    <Link href={local(place.href)} prefetch={false} className="flex items-center gap-2 rounded-md px-1.5 py-1 font-service text-sm text-foreground/90 hover:bg-white/[0.06]">
                      <Image src={place.token} alt="" width={24} height={24} className="h-5 w-5 shrink-0 object-contain" />
                      <span className="truncate">{placeLabel(place, serviceLocale, gameLocale)}</span>
                      {placeIsNew(place) && <span className="font-game-text text-[10px] font-bold text-emerald-300">{copy.newLabel}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <section>
            <ul className="space-y-0.5">
              {account.map((item) => (
                <li key={item.href}>
                  <Link href={local(item.href)} prefetch={false} className="flex items-center gap-2 rounded-md px-1.5 py-1 font-service text-sm text-foreground/90 hover:bg-white/[0.06]">
                    <Image src={item.token} alt="" width={24} height={24} className="h-5 w-5 shrink-0 object-contain" />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
