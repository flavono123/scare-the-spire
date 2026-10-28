import type { EntityInfo } from "@/components/patch-note-renderer";

// Server pages pass PatchNoteRenderer only the entities their text can reach,
// instead of the whole graph (2.4 MB of flight data per page).
//
// PatchNoteRenderer resolves entities only by label (nameKo, nameEn,
// aliasesKo, aliasesEn, trimmed and lowercased): [gold] tokens, **bold**
// names, auto-linked names, monster move keywords and monster mentions all
// look up a label that literally occurs in the text, and its BBCode blocks
// [character-low-hp-idle] and [monster-pattern-diff:ID] read every character
// or every monster. Keeping every entity with a label found in the text keeps
// every lookup the renderer can make complete and in the original order, so
// it renders exactly what the full graph renders.

/** BBCode tags such as [gold], [gold:card], [/gold], [sine] or [energy:2]. */
const BBCODE_TAG_RE = /\[\/?[a-z][\w-]*(?::[^\]\n]*)?\]/gi;
const CHARACTER_BLOCK_TOKEN = "[character-low-hp-idle";
const MONSTER_BLOCK_TOKEN = "[monster-pattern-diff:";

function entityLabels(entity: EntityInfo): string[] {
  return [
    entity.nameKo,
    entity.nameEn,
    ...(entity.aliasesKo ?? []),
    ...(entity.aliasesEn ?? []),
  ]
    .map((label) => label?.trim().toLowerCase() ?? "")
    .filter(Boolean);
}

/**
 * The entities whose label occurs in any of `texts` (case-insensitive), plus
 * every character or monster when a text contains the block that lists them.
 * Keeps the original order and object identity.
 */
export function selectEntitiesForTexts(
  entities: readonly EntityInfo[],
  texts: readonly string[],
): EntityInfo[] {
  // A [gold] token's text is read with nested tags removed
  // ("[gold]Name[sine]+[/sine][/gold]" -> "Name+"), so search that form too.
  const haystack = texts
    .flatMap((text) => {
      const lower = text.toLowerCase();
      const untagged = text.replace(BBCODE_TAG_RE, "").toLowerCase();
      return untagged === lower ? [lower] : [lower, untagged];
    })
    .join("\n");
  const allCharacters = texts.some((text) => text.includes(CHARACTER_BLOCK_TOKEN));
  const allMonsters = texts.some((text) => text.includes(MONSTER_BLOCK_TOKEN));
  const found = new Map<string, boolean>();
  const occurs = (label: string) => {
    let hit = found.get(label);
    if (hit === undefined) {
      hit = haystack.includes(label);
      found.set(label, hit);
    }
    return hit;
  };

  return entities.filter((entity) => (
    (allCharacters && entity.type === "character")
    || (allMonsters && entity.type === "monster")
    || entityLabels(entity).some(occurs)
  ));
}

/** Every string in a JSON-like value (arrays and plain objects), depth first. */
export function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectStrings(item, out);
  }
  return out;
}
