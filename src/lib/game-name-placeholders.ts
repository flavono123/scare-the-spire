// The game fills Test Subject's name with a combat-only counter ("#C{Count}",
// Russian "№{Count}"). Outside combat there is no value, and in every locale
// the name without the counter is the game's own TEST_SUBJECT_BOSS title.
const NAME_COUNTER_PLACEHOLDER = /\s*(?:#C|№)\{Count\}/g;

export function stripNameCounterPlaceholder(text: string): string {
  return text.replace(NAME_COUNTER_PLACEHOLDER, "");
}

/** Strips the counter from the name fields of raw monster or encounter records. */
export function withoutNameCounterPlaceholders<T extends { name: string }>(
  records: readonly T[],
): T[] {
  return records.map((record) => ({
    ...record,
    name: stripNameCounterPlaceholder(record.name),
  }));
}
