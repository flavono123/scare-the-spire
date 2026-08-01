import { notFound } from "next/navigation";
import { BadgeDetail } from "@/components/codex/badge-detail";
import { getCodexResourceOgMetadata } from "@/lib/codex-resource-og";
import { getCodexServiceMessages } from "@/lib/codex-service";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
  localizeHrefWithGameLocale,
} from "@/lib/i18n";
import { getActiveRunBadgeCatalog } from "@/lib/run-badge-catalog";
import { getRunBadgeVariants } from "@/lib/run-badges";
import { absoluteSiteUrl } from "@/lib/site-origin";

type DetailProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateStaticParams() {
  const badges = await getActiveRunBadgeCatalog("eng");
  return badges.map((badge) => ({ id: badge.slug }));
}

export async function generateMetadata({ params, searchParams }: DetailProps) {
  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const badges = await getActiveRunBadgeCatalog(gameLocale);
  const badge = badges.find((candidate) => candidate.slug === id.toLowerCase());
  if (!badge) return {};

  const variants = getRunBadgeVariants(badge);
  const title = variants.map((variant) => variant.title).join(" · ");
  const metadata = getCodexResourceOgMetadata(serviceLocale, getCodexServiceMessages(serviceLocale).badgesView.title, {
    name: title,
    description: variants.map((variant) => variant.description).join(" "),
    imageUrl: badge.imageUrl,
  });
  const canonicalUrl = absoluteSiteUrl(localizeHrefWithGameLocale(
    `/compendium/badges/${badge.slug}`,
    serviceLocale,
    gameLocale,
  ));

  return {
    ...metadata,
    alternates: { canonical: canonicalUrl },
    openGraph: metadata.openGraph ? { ...metadata.openGraph, url: canonicalUrl } : undefined,
  };
}

export default async function BadgeDetailPage({ params, searchParams }: DetailProps) {
  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const serviceText = getCodexServiceMessages(serviceLocale);
  const badges = await getActiveRunBadgeCatalog(gameLocale);
  const badge = badges.find((candidate) => candidate.slug === id.toLowerCase());
  if (!badge) notFound();

  return (
    <BadgeDetail
      serviceLocale={serviceLocale}
      gameLocale={gameLocale}
      backToListTitle={serviceText.badgesView.title}
      badge={badge}
    />
  );
}
