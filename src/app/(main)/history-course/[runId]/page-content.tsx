import type { Metadata } from "next";
import { DeferredRunDetailLoader } from "@/components/history-course/deferred-run-detail-loader";
import { StaticDetailShell } from "@/components/static-detail-shell";
import { getHistoryCourseLandingGameCopy } from "@/lib/borrowed-game-copy";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { HISTORY_COURSE_PAGE_OG_IMAGE } from "@/lib/page-og-images";
import { getDonatedRunOgFields } from "@/lib/run-donation";
import { isCoverSpec } from "@/lib/run-cover-types";
import {
  composeToyBoxPostOgDescription,
  getServiceBrand,
} from "@/lib/service-metadata";
import { withSearchCanonical } from "@/lib/search-canonical";
import { absoluteSiteUrl, SITE_METADATA_BASE } from "@/lib/site-origin";
import { metadataRecordId } from "@/lib/static-detail-shell";
import { coverOgImageFromFields } from "@/lib/toybox-post-og";
import { serviceMessages } from "@/messages/service";

export async function generateHistoryCourseRunMetadata(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
  runId?: string,
): Promise<Metadata> {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const landing = await getHistoryCourseLandingGameCopy(gameLocale);
  const brand = getServiceBrand(serviceLocale);
  const copy = serviceMessages[serviceLocale];
  const fallbackTitle = `${copy.nav.historyCourse} — ${copy.historyCourse.runTitleSuffix}`;
  const description = composeToyBoxPostOgDescription({
    serviceLocale,
    serviceName: copy.nav.historyCourse,
    serviceDescription: copy.historyCourse.subtitle,
  });
  const recordId = metadataRecordId(runId);
  // The prerendered ID shell has no record URL; the worker adds its canonical.
  const canonicalPath = recordId ? `/history-course/${recordId}` : undefined;

  // Bounded single-row lookup (cover_spec + character only). No raw parse /
  // image generation — CF Free-safe. Private IDB-only runs keep the fallback.
  const ogFields = recordId ? await getDonatedRunOgFields(recordId) : null;
  const cover = isCoverSpec(ogFields?.coverSpec) ? ogFields.coverSpec : null;
  const runTitle = cover
    ? (cover.titlePhrase?.trim() || cover.phrase.trim())
    : "";
  // Share title is the lockup title, not the thumbnail overlay hook.
  const title = runTitle
    ? `${runTitle} - ${brand} ${landing.title}`
    : fallbackTitle;
  const imageSource = ogFields ? coverOgImageFromFields(ogFields) : HISTORY_COURSE_PAGE_OG_IMAGE;
  const image = {
    ...imageSource,
    url: absoluteSiteUrl(imageSource.url),
  };

  const metadata: Metadata = {
    metadataBase: SITE_METADATA_BASE,
    title: { absolute: title },
    description,
    openGraph: {
      title,
      description,
      siteName: brand,
      images: [image],
      locale: serviceLocale === "ko" ? "ko_KR" : "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image.url],
    },
  };

  return canonicalPath ? withSearchCanonical(metadata, canonicalPath, serviceLocale) : metadata;
}

export async function renderHistoryCourseRunPage() {
  return (
    <StaticDetailShell idProp="runId">
      <DeferredRunDetailLoader runId="" />
    </StaticDetailShell>
  );
}
