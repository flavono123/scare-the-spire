import type { Metadata } from "next";
import { generateBetaArtMetadata, renderBetaArtPage } from "./page-content";

export async function generateMetadata(): Promise<Metadata> {
  return generateBetaArtMetadata();
}

export default async function BetaArtPage() {
  return renderBetaArtPage();
}
