import { Suspense } from "react";
import { getCodexMonsters, getCodexEncounters } from "@/lib/codex-data";
import { EncounterLibrary } from "@/components/codex/encounter-library";

export const metadata = {
  title: "전투 도감 — 슬서운이야기",
  description: "슬레이 더 스파이어 2의 전투(encounter) 목록. 막별/유형별 전투 구성과 몬스터 조합을 확인하세요.",
};

export default async function CodexEncountersPage() {
  const [encounters, monsters] = await Promise.all([
    getCodexEncounters(),
    getCodexMonsters(),
  ]);

  return (
    <Suspense>
      <EncounterLibrary encounters={encounters} monsters={monsters} />
    </Suspense>
  );
}
