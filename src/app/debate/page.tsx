import type { Metadata } from "next";
import { generateDebateMetadata, renderDebatePage } from "./page-content";

export async function generateMetadata(): Promise<Metadata> {
  return generateDebateMetadata();
}

export default async function DebatePage() {
  return renderDebatePage();
}
