import { Suspense } from "react";
import { getCodexMonsters, getCodexEncounters } from "@/lib/codex-data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { MonsterLibrary } from "@/components/codex/monster-library";

export default async function CodexMonstersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const [monsters, encounters] = await Promise.all([
    getCodexMonsters({ gameLocale }),
    getCodexEncounters({ gameLocale }),
  ]);

  return (
    <Suspense>
      <MonsterLibrary
        serviceLocale={serviceLocale}
        monsters={monsters}
        encounters={encounters}
      />
    </Suspense>
  );
}
