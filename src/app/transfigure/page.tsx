import type { Metadata } from "next";
import {
  generateTransfigureMetadata,
  renderTransfigurePage,
} from "./page-content";

export async function generateMetadata(): Promise<Metadata> {
  return generateTransfigureMetadata();
}

export default async function TransfigurePage() {
  return renderTransfigurePage();
}
