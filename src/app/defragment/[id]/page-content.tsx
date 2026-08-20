import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DefragmentPostView } from "@/components/defragment/defragment-post-view";
import { ServiceBackground } from "@/components/service-background";
import { getDefragmentGameCopy } from "@/lib/borrowed-game-copy";
import { DEFRAGMENT_BACKGROUND_SRC, isDefragmentFederatedService } from "@/lib/defragment";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { DEFRAGMENT_PAGE_OG_IMAGE } from "@/lib/page-og-images";
import {
  composeToyBoxPostOgDescription,
  getServiceMetadataCopy,
  getServiceOgMetadata,
} from "@/lib/service-metadata";
import { TOYBOX_NARROW_SHELL_CLASS } from "@/lib/toybox-layout";
import { serviceMessages } from "@/messages/service";

export async function generateDefragmentPostMetadata(
  id?: string,
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
): Promise<Metadata> {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const copy = getServiceMetadataCopy(serviceLocale);
  const gameCopy = await getDefragmentGameCopy(gameLocale);
  const description = composeToyBoxPostOgDescription({
    serviceLocale,
    serviceName: serviceMessages[serviceLocale].nav.defragment,
    serviceDescription: copy.defragmentDescription,
  });
  return getServiceOgMetadata({
    serviceLocale,
    title: gameCopy.title,
    description,
    image: DEFRAGMENT_PAGE_OG_IMAGE,
    canonicalPath: id ? `/defragment/${id}` : "/defragment",
  });
}

export async function renderDefragmentPostPage(
  id: string,
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
) {
  if (isDefragmentFederatedService(id)) notFound();

  const gameCopy = await getDefragmentGameCopy(gameLocale);

  return (
    <div className="relative isolate min-h-[calc(100svh-3rem)]">
      <ServiceBackground
        src={DEFRAGMENT_BACKGROUND_SRC}
        imageClassName="object-[58%_center] sm:object-center"
      />
      <div className={TOYBOX_NARROW_SHELL_CLASS}>
        <DefragmentPostView
          postId={id}
          gameLocale={gameLocale}
          placeholder={gameCopy.placeholder}
        />
      </div>
    </div>
  );
}
