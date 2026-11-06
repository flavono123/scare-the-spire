import toyBoxNewsPayload from "@/generated/toy-box-news.json";

interface ToyBoxNewsPayload {
  latestDate: string | null;
  newSectionTitles: string[];
}

const toyBoxNews = toyBoxNewsPayload as ToyBoxNewsPayload;

/** True until a byrdispatch entry newer than `date` is published. */
export function isLatestByrdispatchOnOrBefore(date: string): boolean {
  return toyBoxNews.latestDate !== null && toyBoxNews.latestDate <= date;
}

export function isLatestByrdispatchNewSection(sectionTitle: string): boolean {
  return toyBoxNews.newSectionTitles.includes(sectionTitle);
}
