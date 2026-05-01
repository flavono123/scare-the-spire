import { Suspense } from "react";
import { getCodexMonsters, getCodexEncounters } from "@/lib/codex-data";
import { getGameLocaleFromSearchRecord } from "@/lib/i18n";
import { MonsterLibrary } from "@/components/codex/monster-library";

export default async function CodexMonstersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const gameLocale = getGameLocaleFromSearchRecord(await searchParams);
  const [monsters, encounters] = await Promise.all([
    getCodexMonsters({ gameLocale }),
    getCodexEncounters({ gameLocale }),
  ]);

  return (
    <Suspense>
      <MonsterLibrary monsters={monsters} encounters={encounters} />
    </Suspense>
  );
}
