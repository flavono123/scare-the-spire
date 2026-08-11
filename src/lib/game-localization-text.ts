export type GameLocalizationTable = Record<string, string>;

export function gameText(
  table: GameLocalizationTable | null,
  key: string,
  fallback: string,
): string {
  return table?.[key] ?? fallback;
}

export function gameNullableText(
  table: GameLocalizationTable | null,
  key: string,
  fallback: string | null,
): string | null {
  return table?.[key] ?? fallback;
}
