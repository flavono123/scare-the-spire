import { Suspense } from "react";
import { Metadata } from "next";
import { getCodexEnchantments, getCodexRelics } from "@/lib/codex-data";
import { loadAllEntities } from "@/lib/load-all-entities";
import { getVersionsWithDiffs } from "@/lib/entity-versioning";
import { getSTS2Patches, getEntityVersionDiffs, getCodexMeta } from "@/lib/data";
import { EnchantmentLibrary } from "@/components/codex/enchantment-library";

export const metadata: Metadata = {
  title: "인챈트 도감 - 슬서운 이야기",
  description:
    "슬레이 더 스파이어 2 인챈트 도감. 카드에 부여되는 특수 강화 효과를 확인하세요.",
};

export default async function CodexEnchantmentsPage() {
  const [enchantments, relics, patches, versionDiffs, meta, entities] = await Promise.all([
    getCodexEnchantments(),
    getCodexRelics(),
    getSTS2Patches(),
    getEntityVersionDiffs(),
    getCodexMeta(),
    loadAllEntities(),
  ]);

  const versions = getVersionsWithDiffs(patches, versionDiffs);

  return (
    <Suspense>
      <EnchantmentLibrary
        enchantments={enchantments}
        versions={versions}
        currentVersion={meta.version}
        patches={patches}
        versionDiffs={versionDiffs}
        entities={entities}
        relics={relics}
      />
    </Suspense>
  );
}
