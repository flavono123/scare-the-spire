import { getCodexCards, getCodexCharacters } from "@/lib/codex-data";
import { getVersionsWithDiffs } from "@/lib/entity-versioning";
import { getSTS2Patches, getEntityVersionDiffs, getCodexMeta } from "@/lib/data";
import { CardLibrary } from "@/components/codex/card-library";

export default async function CodexCardsPage() {
  const [cards, characters, patches, versionDiffs, meta] = await Promise.all([
    getCodexCards(),
    getCodexCharacters(),
    getSTS2Patches(),
    getEntityVersionDiffs(),
    getCodexMeta(),
  ]);

  const versions = getVersionsWithDiffs(patches, versionDiffs);

  return (
    <CardLibrary
      cards={cards}
      characters={characters}
      versions={versions}
      currentVersion={meta.version}
      patches={patches}
      versionDiffs={versionDiffs}
    />
  );
}
