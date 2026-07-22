import type { Metadata } from "next";
import {
  generateCompendiumBestiaryMetadata,
  renderCompendiumBestiaryPage,
} from "./page-content";

export const dynamic = "force-static";

export async function generateMetadata(): Promise<Metadata> {
  return generateCompendiumBestiaryMetadata();
}

export default async function CompendiumBestiaryPage() {
  return renderCompendiumBestiaryPage();
}
