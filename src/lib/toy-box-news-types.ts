// Shape of src/generated/toy-box-news.json, shared with its stage-1 builder
// (scripts/lib/source-json-payloads.ts) without importing the generated file.

export interface ToyBoxNewsPayload {
  latestDate: string | null;
  newSectionTitles: string[];
  /** False once BYRDISPATCH_NEW_TTL_DAYS have passed since latestDate (judged at build). */
  newActive: boolean;
}
