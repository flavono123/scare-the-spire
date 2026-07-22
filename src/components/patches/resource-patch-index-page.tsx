import type { Metadata } from "next";
import fs from "fs/promises";
import path from "path";
import Image from "@/components/ui/static-image";
import { PatchSectionTabs } from "@/components/patches/patch-section-tabs";
import { ResourcePatchIndexExplorer } from "@/components/patches/resource-patch-index-explorer";
import {
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import { PATCH_NOTES_PAGE_OG_IMAGE } from "@/lib/page-og-images";
import {
  RESOURCE_PATCH_INDEX_ASSET,
  type ResourcePatchIndexData,
} from "@/lib/resource-patch-index";
import { getServiceOgMetadata } from "@/lib/service-metadata";
import { getStoryComposerPlaceholder } from "@/lib/sts2-game-ui-copy";
import { serviceMessages } from "@/messages/service";

export function getResourcePatchIndexMetadata(serviceLocale: ServiceLocale): Metadata {
  const copy = serviceMessages[serviceLocale].patchChanges;
  return getServiceOgMetadata({
    serviceLocale,
    title: copy.title,
    description: copy.metadataDescription,
    image: PATCH_NOTES_PAGE_OG_IMAGE,
  });
}

async function getResourcePatchIndexData(): Promise<ResourcePatchIndexData> {
  const filePath = path.join(process.cwd(), "public/generated/sts2-resource-patch-index.json");
  return JSON.parse(await fs.readFile(filePath, "utf-8")) as ResourcePatchIndexData;
}

export async function ResourcePatchIndexPage({
  serviceLocale,
  gameLocale,
}: {
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
}) {
  const [data, storyPlaceholder] = await Promise.all([
    getResourcePatchIndexData(),
    getStoryComposerPlaceholder(gameLocale),
  ]);
  const copy = serviceMessages[serviceLocale].patchChanges;

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
        data-game-locale={gameLocale}
        data-story-placeholder={storyPlaceholder}
      >
        <ResourcePatchIndexExplorer
          data={data}
          serviceLocale={serviceLocale}
          gameLocale={gameLocale}
          storyPlaceholder={storyPlaceholder}
        />
      </div>
    </div>
  );
}
