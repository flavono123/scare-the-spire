import toyBoxNewsPayload from "@/generated/toy-box-news.json";

interface ToyBoxNewsPayload {
  latestDate: string | null;
  newSectionTitles: string[];
}

const toyBoxNews = toyBoxNewsPayload as ToyBoxNewsPayload;

export function isLatestByrdispatchNewSection(sectionTitle: string): boolean {
  return toyBoxNews.newSectionTitles.includes(sectionTitle);
}
