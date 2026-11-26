import type { Metadata } from "next";
import {
  generateDecisionsDecisionsWriteMetadata,
  renderDecisionsDecisionsWritePage,
} from "./page-content";

export async function generateMetadata(): Promise<Metadata> {
  return generateDecisionsDecisionsWriteMetadata();
}

export default async function DecisionsDecisionsWritePage() {
  return renderDecisionsDecisionsWritePage();
}
