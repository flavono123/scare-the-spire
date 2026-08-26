import catalog from "../../data/sts2/card-multiplayer-constraints.json";

const MULTIPLAYER_ONLY_IDS = new Set(catalog.multiplayerOnlyIds);

/** Catalog lookup only — game `CardMultiplayerConstraint.MultiplayerOnly`. */
export function isMultiplayerOnlyCardId(id: string): boolean {
  return MULTIPLAYER_ONLY_IDS.has(id);
}
