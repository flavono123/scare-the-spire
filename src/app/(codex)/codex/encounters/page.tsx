import { Suspense } from "react";
import { getCodexMonsters, getCodexEncounters } from "@/lib/codex-data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { EncounterLibrary } from "@/components/codex/encounter-library";

export const metadata = {
  title: "전투 도감 — 슬서운이야기",
  description: "슬레이 더 스파이어 2의 전투(encounter) 목록. 막별/유형별 전투 구성과 몬스터 조합을 확인하세요.",
};

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
