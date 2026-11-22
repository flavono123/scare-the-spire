import Image from "@/components/ui/static-image";
import type { Metadata } from "next";
import { IndexPageHeader } from "@/components/place-index/index-page-header";
import { IndexTileToken } from "@/components/place-index/index-tile";
import { NavAttentionMarkers } from "@/components/place-index/nav-attention-markers";
import { placeTileProps } from "@/components/place-index/place-tiles";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexMetadata } from "@/lib/codex-service";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import { PLACE_AREA_META, placesInArea } from "@/lib/place-registry";
import { TOYBOX_WIDE_SHELL_CLASS } from "@/lib/toybox-layout";
import { serviceMessages } from "@/messages/service";

export const dynamic = "force-static";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const gameUi = await getCodexGameUiLabels(gameLocale);
  return getCodexMetadata(serviceLocale, gameUi.compendiumTitle, "/compendium");
}

export default async function CodexIndexPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const copy = serviceMessages[serviceLocale].placeIndex;
  const gameUi = await getCodexGameUiLabels(gameLocale);
  const sections = (["sts2", "sts1"] as const).map((area) => ({
    area,
    title: copy.areas[area],
    token: PLACE_AREA_META[area].token,
    tiles: placesInArea(area).map((place) => placeTileProps(place, serviceLocale, gameLocale)),
  }));

  return (
    <div className="relative isolate min-h-[calc(100svh-3rem)]" data-place-index="compendium">
      <div className={TOYBOX_WIDE_SHELL_CLASS}>
        <IndexPageHeader
          title={gameUi.compendiumTitle}
          token={PLACE_AREA_META.sts2.token}
          art={PLACE_AREA_META.sts2.art}
        />
        {sections.map((section) => (
          <section key={section.area} id={section.area} className="mt-8 scroll-mt-16">
            <h2 className="flex items-center gap-2 font-game-title text-lg text-primary/90">
              <Image src={section.token} alt="" width={28} height={28} className="h-6 w-6 object-contain" />
              {section.title}
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {section.tiles.map((tile) => (
                <IndexTileToken key={tile.href} {...tile} />
              ))}
            </div>
          </section>
        ))}
      </div>
      <NavAttentionMarkers />
    </div>
  );
}
