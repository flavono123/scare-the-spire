import type { Metadata } from "next";
import Image from "@/components/ui/static-image";
import { PatchSectionTabs } from "@/components/patches/patch-section-tabs";
import { ResourcePatchIndexExplorer } from "@/components/patches/resource-patch-index-explorer";
import { getSTS2Patches, getSTS2PatchLines, getSTS2Stories } from "@/lib/data";
import {
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import { loadAllEntities } from "@/lib/load-all-entities";
import { PATCH_NOTES_PAGE_OG_IMAGE } from "@/lib/page-og-images";
import {
  buildResourcePatchIndex,
  RESOURCE_PATCH_INDEX_ASSET,
} from "@/lib/resource-patch-index";
import { getServiceOgMetadata } from "@/lib/service-metadata";
import { getStoryComposerPlaceholder } from "@/lib/sts2-game-ui-copy";

const COPY = {
  ko: {
    title: "변경 기록",
    description: "카드, 유물, 캐릭터별 슬레이 더 스파이어 2 패치 변경 기록",
  },
  en: {
    title: "Change History",
    description: "Slay the Spire 2 patch changes by card, relic, character, and more.",
  },
} as const;

export function getResourcePatchIndexMetadata(serviceLocale: ServiceLocale): Metadata {
  const copy = COPY[serviceLocale];
  return getServiceOgMetadata({
    serviceLocale,
    title: copy.title,
    description: copy.description,
    image: PATCH_NOTES_PAGE_OG_IMAGE,
  });
}

export async function ResourcePatchIndexPage({
  serviceLocale,
  gameLocale,
}: {
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
}) {
  const [patchLines, patches, entities, stories, storyPlaceholder] = await Promise.all([
    getSTS2PatchLines(),
    getSTS2Patches(),
    loadAllEntities({ gameLocale: "kor" }),
    getSTS2Stories(),
    getStoryComposerPlaceholder(gameLocale),
  ]);
  const data = buildResourcePatchIndex({ patchLines, patches, entities, stories });
  const copy = COPY[serviceLocale];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="flex items-center gap-2 font-game-title text-2xl font-bold">
        <Image
          src="/images/sts2/ui/topbar/submenu_history_icon.png"
          alt=""
          width={34}
          height={34}
          className="h-9 w-9 object-contain"
        />
        {copy.title}
      </h1>
      <PatchSectionTabs
        active="changes"
        serviceLocale={serviceLocale}
        gameLocale={gameLocale}
      />
      <div
        id="sts-resource-patch-index-root"
        data-resource-patch-index-asset={RESOURCE_PATCH_INDEX_ASSET}
        data-service-locale={serviceLocale}
        data-story-placeholder={storyPlaceholder}
      >
        <ResourcePatchIndexExplorer
          data={data}
          serviceLocale={serviceLocale}
          storyPlaceholder={storyPlaceholder}
        />
      </div>
    </div>
  );
}
