import { Metadata } from "next";
import { getCodexEnchantments } from "@/lib/codex-data";
import { getVersionsWithDiffs } from "@/lib/entity-versioning";
import { getSTS2Patches, getEntityVersionDiffs, getCodexMeta } from "@/lib/data";
import { EnchantmentLibrary } from "@/components/codex/enchantment-library";

export const metadata: Metadata = {
  title: "인챈트 도감 - 슬서운 이야기",
  description:
    "슬레이 더 스파이어 2 인챈트 도감. 카드에 부여되는 특수 강화 효과를 확인하세요.",
};

export default async function CodexEnchantmentsPage() {
  const [enchantments, patches, versionDiffs, meta] = await Promise.all([
    getCodexEnchantments(),
    getSTS2Patches(),
    getEntityVersionDiffs(),
    getCodexMeta(),
  ]);

  const versions = getVersionsWithDiffs(patches, versionDiffs);

  return (
    <EnchantmentLibrary
      enchantments={enchantments}
      versions={versions}
      currentVersion={meta.version}
      patches={patches}
      versionDiffs={versionDiffs}
    />
  );
}
