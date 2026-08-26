import catalog from "../../data/sts2/card-multiplayer-constraints.json";

const MULTIPLAYER_ONLY_IDS = new Set(catalog.multiplayerOnlyIds);

/** Catalog lookup: C# MultiplayerOnly, plus patch-note MP cards missing from a stale decompile. */
export function isMultiplayerOnlyCardId(id: string): boolean {
  return MULTIPLAYER_ONLY_IDS.has(id);
}
