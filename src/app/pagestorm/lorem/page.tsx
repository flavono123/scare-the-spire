import type { Metadata } from "next";
import {
  generatePagestormLoremMetadata,
  renderPagestormLoremPage,
} from "./page-content";

export async function generateMetadata(): Promise<Metadata> {
  return generatePagestormLoremMetadata();
}

export default async function PagestormLoremPage() {
  return renderPagestormLoremPage();
}
