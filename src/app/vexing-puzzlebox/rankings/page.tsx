import type { Metadata } from "next";
import { generateRankingsMetadata, renderRankingsPage } from "./page-content";

export async function generateMetadata(): Promise<Metadata> {
  return generateRankingsMetadata();
}

export default async function RankingsPage() {
  return renderRankingsPage();
}
