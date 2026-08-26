import type { Metadata } from "next";
import {
  generateDecisionsDecisionsMetadata,
  renderDecisionsDecisionsPage,
} from "./page-content";

export async function generateMetadata(): Promise<Metadata> {
  return generateDecisionsDecisionsMetadata();
}

export default async function DecisionsDecisionsPage() {
  return renderDecisionsDecisionsPage();
}
