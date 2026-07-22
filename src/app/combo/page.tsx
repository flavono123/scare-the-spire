import type { Metadata } from "next";
import { generateComboMetadata, renderComboPage } from "./page-content";

export async function generateMetadata(): Promise<Metadata> {
  return generateComboMetadata();
}

export default async function ComboPage() {
  return renderComboPage();
}
