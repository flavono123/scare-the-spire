import { Suspense } from "react";
import { Metadata } from "next";
import { getCodexPowers } from "@/lib/codex-data";
import { getVersionsWithDiffs } from "@/lib/entity-versioning";
import { getSTS2Patches, getEntityVersionDiffs, getCodexMeta } from "@/lib/data";
import { PowerLibrary } from "@/components/codex/power-library";

export const metadata: Metadata = {
  title: "파워 도감 - 슬서운 이야기",
  description:
    "슬레이 더 스파이어 2 파워(버프/디버프) 도감. 전투 중 캐릭터와 몬스터에 적용되는 모든 효과를 확인하세요.",
};

export default async function CodexPowersPage() {
  const [powers, patches, versionDiffs, meta] = await Promise.all([
    getCodexPowers(),
    getSTS2Patches(),
    getEntityVersionDiffs(),
    getCodexMeta(),
  ]);

  const versions = getVersionsWithDiffs(patches, versionDiffs);

  return (
    <Suspense>
      <PowerLibrary
        powers={powers}
        versions={versions}
        currentVersion={meta.version}
        patches={patches}
        versionDiffs={versionDiffs}
      />
    </Suspense>
  );
}
