import type { Metadata } from "next";
import {
  generateChemicalXMetadata,
  renderChemicalXPage,
} from "./page-content";

export async function generateMetadata(): Promise<Metadata> {
  return generateChemicalXMetadata();
}

export default async function ChemicalXPage() {
  return renderChemicalXPage();
}
