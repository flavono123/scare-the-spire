import { Suspense } from "react";
import type { Metadata } from "next";
import { BadgeLibrary } from "@/components/codex/badge-library";
import { getCodexMetadata, getCodexServiceMessages } from "@/lib/codex-service";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getActiveRunBadgeCatalog } from "@/lib/run-badge-catalog";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const serviceLocale = getServiceLocaleFromSearchRecord(await searchParams);
  return getCodexMetadata(serviceLocale, getCodexServiceMessages(serviceLocale).badgesView.title, "/compendium/badges");
}

export default async function CodexBadgesPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const serviceText = getCodexServiceMessages(serviceLocale);
  const badges = await getActiveRunBadgeCatalog(gameLocale);

  return (
    <Suspense>
      <BadgeLibrary
        serviceLocale={serviceLocale}
        gameLocale={gameLocale}
        title={serviceText.badgesView.title}
        badges={badges}
      />
    </Suspense>
  );
}
