import { Suspense } from "react";
import { Metadata } from "next";
import { getCodexRelics, getCodexCharacters } from "@/lib/codex-data";
import { getVersionsWithDiffs } from "@/lib/entity-versioning";
import { getSTS2Patches, getEntityVersionDiffs, getCodexMeta } from "@/lib/data";
import { RelicLibrary } from "@/components/codex/relic-library";

export const metadata: Metadata = {
  title: "유물 도감 - 슬서운 이야기",
  description: "슬레이 더 스파이어 2 유물 도감. 314개 유물의 효과와 정보를 확인하세요.",
};

export default async function CodexRelicsPage() {
  const [relics, characters, patches, versionDiffs, meta] = await Promise.all([
    getCodexRelics(),
    getCodexCharacters(),
    getSTS2Patches(),
    getEntityVersionDiffs(),
    getCodexMeta(),
  ]);

  const versions = getVersionsWithDiffs(patches, versionDiffs);

  return (
    <Suspense>
      <RelicLibrary
        relics={relics}
        characters={characters}
        versions={versions}
        currentVersion={meta.version}
        patches={patches}
        versionDiffs={versionDiffs}
      />
    </Suspense>
  );
}
