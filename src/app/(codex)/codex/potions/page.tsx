import { Suspense } from "react";
import { getCodexPotions, getCodexCharacters } from "@/lib/codex-data";
import { getVersionsWithDiffs } from "@/lib/entity-versioning";
import { getSTS2Patches, getEntityVersionDiffs, getCodexMeta } from "@/lib/data";
import { PotionLibrary } from "@/components/codex/potion-library";

export default async function CodexPotionsPage() {
  const [potions, characters, patches, versionDiffs, meta] = await Promise.all([
    getCodexPotions(),
    getCodexCharacters(),
    getSTS2Patches(),
    getEntityVersionDiffs(),
    getCodexMeta(),
  ]);

  const versions = getVersionsWithDiffs(patches, versionDiffs);

  return (
    <Suspense>
      <PotionLibrary
        potions={potions}
        characters={characters}
        versions={versions}
        currentVersion={meta.version}
        patches={patches}
        versionDiffs={versionDiffs}
      />
    </Suspense>
  );
}
