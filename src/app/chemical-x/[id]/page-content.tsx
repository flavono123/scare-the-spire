import type { Metadata } from "next";
import { ChemicalXPostView } from "@/components/chemicalx/post-view";
import { StaticDetailShell } from "@/components/static-detail-shell";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { CHEMICAL_X_PAGE_OG_IMAGE } from "@/lib/page-og-images";
import {
  composeToyBoxPostOgDescription,
  getServiceMetadataCopy,
  getServiceOgMetadata,
} from "@/lib/service-metadata";
import { metadataRecordId } from "@/lib/static-detail-shell";
import { TOYBOX_NARROW_SHELL_CLASS } from "@/lib/toybox-layout";
import { serviceMessages } from "@/messages/service";

export async function generateChemicalXPostMetadata(
  id?: string,
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
): Promise<Metadata> {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const copy = getServiceMetadataCopy(serviceLocale);
  const description = composeToyBoxPostOgDescription({
    serviceLocale,
    serviceName: serviceMessages[serviceLocale].nav.chemicalX,
    serviceDescription: serviceMessages[serviceLocale].chemicalX.subtitle,
  });
  const recordId = metadataRecordId(id);
  // Only the shell's metadata: a record's own fields are the main Worker's job
  // (workers/detail-shell-og.ts, on with DETAIL_SHELL_OG=d1), not the build's.
  return getServiceOgMetadata({
    serviceLocale,
    title: copy.chemicalXTitle,
    description,
    image: CHEMICAL_X_PAGE_OG_IMAGE,
    canonicalPath: recordId ? `/chemical-x/${recordId}` : undefined,
  });
}

export async function renderChemicalXPostPage() {
  return (
    <div className={TOYBOX_NARROW_SHELL_CLASS}>
      <StaticDetailShell>
        <ChemicalXPostView postId="" />
      </StaticDetailShell>
    </div>
  );
}
