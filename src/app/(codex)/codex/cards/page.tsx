import { Suspense } from "react";
import {
  getCodexCards,
  getCodexCharacters,
  getCodexEnchantments,
} from "@/lib/codex-data";
import { getVersionsWithDiffs } from "@/lib/entity-versioning";
import { getSTS2Patches, getEntityVersionDiffs, getCodexMeta } from "@/lib/data";
import { CardLibrary } from "@/components/codex/card-library";

export default async function CodexCardsPage() {
  const [cards, characters, patches, versionDiffs, meta, enchantments] =
    await Promise.all([
      getCodexCards(),
      getCodexCharacters(),
      getSTS2Patches(),
      getEntityVersionDiffs(),
      getCodexMeta(),
      getCodexEnchantments(),
    ]);

  const versions = getVersionsWithDiffs(patches, versionDiffs);

  return (
    <Suspense>
      <CardLibrary
        cards={cards}
        characters={characters}
        versions={versions}
        currentVersion={meta.version}
        patches={patches}
        versionDiffs={versionDiffs}
        enchantments={enchantments}
      />
    </Suspense>
  );
}
