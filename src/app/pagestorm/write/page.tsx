import type { Metadata } from "next";
import {
  generatePagestormWriteMetadata,
  renderPagestormWritePage,
} from "./page-content";

export async function generateMetadata(): Promise<Metadata> {
  return generatePagestormWriteMetadata();
}

export default async function PagestormWritePage() {
  return renderPagestormWritePage();
}
