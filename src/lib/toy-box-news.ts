import toyBoxNewsPayload from "@/generated/toy-box-news.json";

interface ToyBoxNewsPayload {
  latestDate: string | null;
  newSectionTitles: string[];
  /** False once BYRDISPATCH_NEW_TTL_DAYS have passed since latestDate (judged at build). */
  newActive: boolean;
}

const toyBoxNews = toyBoxNewsPayload as ToyBoxNewsPayload;

/** True until a byrdispatch entry newer than `date` is published or the NEW TTL runs out. */
export function isLatestByrdispatchOnOrBefore(date: string): boolean {
  return toyBoxNews.newActive && toyBoxNews.latestDate !== null && toyBoxNews.latestDate <= date;
}

export function isLatestByrdispatchNewSection(sectionTitle: string): boolean {
  return toyBoxNews.newActive && toyBoxNews.newSectionTitles.includes(sectionTitle);
}
