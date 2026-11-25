import toyBoxNewsPayload from "@/generated/toy-box-news.json";
import type { ToyBoxNewsPayload } from "@/lib/toy-box-news-types";

const toyBoxNews = toyBoxNewsPayload as ToyBoxNewsPayload;

/** True until a byrdispatch entry newer than `date` is published or the NEW TTL runs out. */
export function isLatestByrdispatchOnOrBefore(date: string): boolean {
  return toyBoxNews.newActive && toyBoxNews.latestDate !== null && toyBoxNews.latestDate <= date;
}

export function isLatestByrdispatchNewSection(sectionTitle: string): boolean {
  return toyBoxNews.newActive && toyBoxNews.newSectionTitles.includes(sectionTitle);
}
