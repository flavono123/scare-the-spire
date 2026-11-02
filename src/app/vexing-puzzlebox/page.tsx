import type { Metadata } from "next";
import { generateVexingPuzzleboxMetadata, renderVexingPuzzleboxPage } from "./page-content";

export async function generateMetadata(): Promise<Metadata> {
  return generateVexingPuzzleboxMetadata();
}

export default async function VexingPuzzleboxPage() {
  return renderVexingPuzzleboxPage();
}
