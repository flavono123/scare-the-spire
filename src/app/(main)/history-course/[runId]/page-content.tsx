import type { Metadata } from "next";
import { DeferredRunDetailLoader } from "@/components/history-course/deferred-run-detail-loader";
import { getHistoryCourseLandingGameCopy } from "@/lib/borrowed-game-copy";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import {
  HISTORY_COURSE_PAGE_OG_IMAGE,
  type PageOgImage,
} from "@/lib/page-og-images";
import { getDonatedRunOgFields } from "@/lib/run-donation";
import {
  coverCardArtSrc,
  coverCharacterSelectSrc,
} from "@/lib/run-cover-suggest";
import type { CoverSpec } from "@/lib/run-cover-types";
import { isCoverSpec } from "@/lib/run-cover-types";
import { getServiceBrand } from "@/lib/service-metadata";
import { withKoreanSearchCanonical } from "@/lib/search-canonical";
import { absoluteSiteUrl, SITE_METADATA_BASE } from "@/lib/site-origin";
import { serviceMessages } from "@/messages/service";

function ogImageFromRun(fields: {
  character: string;
  coverSpec: CoverSpec | null;
}): PageOgImage {
  const cover = isCoverSpec(fields.coverSpec) ? fields.coverSpec : null;
  if (cover?.background.kind === "card-beta") {
    const art = coverCardArtSrc(cover.background.cardId);
    return {
      url: art.src,
      width: 1000,
      height: 760,
      alt: cover.phrase || HISTORY_COURSE_PAGE_OG_IMAGE.alt,
    };
  }
  return {
    url: coverCharacterSelectSrc(fields.character),
    width: 1000,
    height: 760,
    alt: cover?.phrase || HISTORY_COURSE_PAGE_OG_IMAGE.alt,
  };
}

export async function generateHistoryCourseRunMetadata(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
  runId?: string,
): Promise<Metadata> {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const landing = await getHistoryCourseLandingGameCopy(gameLocale);
  const brand = getServiceBrand(serviceLocale);
  const fallbackTitle = `${serviceMessages[serviceLocale].nav.historyCourse} — ${serviceMessages[serviceLocale].historyCourse.runTitleSuffix}`;
  const description = landing.heroQuote;
  const canonicalPath = runId ? `/history-course/${runId}` : "/history-course";

  // Bounded single-row lookup (cover_spec + character only). No raw parse /
  // image generation — CF Free-safe. Private IDB-only runs keep the fallback.
  const ogFields = runId ? await getDonatedRunOgFields(runId) : null;
  const phrase = isCoverSpec(ogFields?.coverSpec) ? ogFields.coverSpec.phrase.trim() : "";
  // Exact share title shape: "{phrase} - 슬서운 이야기 역사 강의서"
  const title = phrase
    ? `${phrase} - ${brand} ${landing.title}`
    : fallbackTitle;
  const imageSource = ogFields ? ogImageFromRun(ogFields) : HISTORY_COURSE_PAGE_OG_IMAGE;
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

  return withKoreanSearchCanonical(metadata, canonicalPath);
}

export async function renderHistoryCourseRunPage(
  runId: string,
) {
  return <DeferredRunDetailLoader runId={runId} />;
}
