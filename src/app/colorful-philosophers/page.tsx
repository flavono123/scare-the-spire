import type { Metadata } from "next";
import { generateColorfulPhilosophersMetadata, renderColorfulPhilosophersPage } from "./page-content";

export async function generateMetadata(): Promise<Metadata> {
  return generateColorfulPhilosophersMetadata();
}

export default async function ColorfulPhilosophersPage() {
  return renderColorfulPhilosophersPage();
}
