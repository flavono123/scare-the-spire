import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DefragmentFederatedPostView } from "@/components/defragment/defragment-federated-post-view";
import { ServiceBackground } from "@/components/service-background";
import {
  getComboPlaceholder,
  getDefragmentGameCopy,
  getThisOrThatGameCopy,
  getTransfigureGameCopy,
  getTransfigureNavTitle,
} from "@/lib/borrowed-game-copy";
import {
  DEFRAGMENT_BACKGROUND_SRC,
  isDefragmentFederatedService,
} from "@/lib/defragment";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { DEFRAGMENT_PAGE_OG_IMAGE } from "@/lib/page-og-images";
import {
  composeToyBoxPostOgDescription,
  getServiceMetadataCopy,
  getServiceOgMetadata,
} from "@/lib/service-metadata";
import { TOYBOX_WIDE_SHELL_CLASS } from "@/lib/toybox-layout";
import { serviceMessages } from "@/messages/service";

export async function generateDefragmentFederatedPostMetadata(
  service: string,
  id?: string,
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
): Promise<Metadata> {
  if (!isDefragmentFederatedService(service)) {
    return {};
  }
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
    canonicalPath: id ? `/defragment/${service}/${id}` : "/defragment",
  });
}

export async function renderDefragmentFederatedPostPage(
  service: string,
  id: string,
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
) {
  if (!isDefragmentFederatedService(service)) notFound();

  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const nav = serviceMessages[serviceLocale].nav;
  const [comboPlaceholder, totCopy, transfigureCopy] = await Promise.all([
    getComboPlaceholder(gameLocale),
    getThisOrThatGameCopy(gameLocale),
    getTransfigureGameCopy(gameLocale),
  ]);
  const typeLabels = {
    combo: nav.combo,
    transfigure: getTransfigureNavTitle(gameLocale),
    this_or_that: nav.thisOrThat,
    chemical_x: nav.chemicalX,
  } as const;

  return (
    <div className="relative isolate min-h-[calc(100svh-3rem)]">
      <ServiceBackground
        src={DEFRAGMENT_BACKGROUND_SRC}
        imageClassName="object-[58%_center] sm:object-center"
      />
      <div className={TOYBOX_WIDE_SHELL_CLASS}>
        <DefragmentFederatedPostView
          service={service}
          postId={id}
          gameLocale={gameLocale}
          typeLabel={typeLabels[service]}
          comboPlaceholder={comboPlaceholder}
          upgradeLabel={transfigureCopy.viewUpgrades}
          thisOrThatTitle={totCopy.title}
          votePrompt={totCopy.votePrompt}
          voteDone={totCopy.voteDone}
        />
      </div>
    </div>
  );
}
