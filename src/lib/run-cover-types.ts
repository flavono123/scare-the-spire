export type CoverBackground =
  | { kind: "character" }
  | { kind: "card-beta"; cardId: string };

export type CoverElementKind = "card" | "relic" | "potion";

export type CoverElement = {
  kind: CoverElementKind;
  id: string;
  copies?: number;
};

export type CoverSpec = {
  background: CoverBackground;
  /** Thumbnail overlay hook. */
  phrase: string;
  /**
   * YouTube-lockup title under the thumbnail. Distinct from `phrase` when
   * the recommendation list has at least two candidates (list[0] / list[1]).
   */
  titlePhrase?: string;
  elements: CoverElement[];
  auto: boolean;
  suggestSeed: string;
};

export type CoverCooccurrenceTable = {
  pairWeight: Record<string, number>;
};

export function isCoverSpec(value: unknown): value is CoverSpec {
  if (!value || typeof value !== "object") return false;
  const v = value as CoverSpec;
  if (!v.background || typeof v.background !== "object") return false;
  if (v.background.kind === "character") {
    // ok
  } else if (v.background.kind === "card-beta" && typeof v.background.cardId === "string") {
    // ok
  } else {
    return false;
  }
  if (v.titlePhrase !== undefined && typeof v.titlePhrase !== "string") {
    return false;
  }
  return (
    typeof v.phrase === "string" &&
    Array.isArray(v.elements) &&
    typeof v.auto === "boolean" &&
    typeof v.suggestSeed === "string"
  );
}
