import { Suspense } from "react";
import type { Metadata } from "next";
import { getCodexMonsters, getCodexEncounters } from "@/lib/codex-data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexMetadata, getCodexServiceMessages } from "@/lib/codex-service";
import { EncounterLibrary } from "@/components/codex/encounter-library";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const serviceLocale = getServiceLocaleFromSearchRecord(await searchParams);
  const serviceText = getCodexServiceMessages(serviceLocale);
  return getCodexMetadata(serviceLocale, serviceText.encountersView.title);
}

export default async function CodexEncountersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const [encounters, monsters] = await Promise.all([
    getCodexEncounters({ gameLocale }),
    getCodexMonsters({ gameLocale }),
  ]);

  return (
    <Suspense>
      <EncounterLibrary serviceLocale={serviceLocale} encounters={encounters} monsters={monsters} />
    </Suspense>
  );
}
