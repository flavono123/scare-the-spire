import type { Metadata } from "next";
import {
  generatePagestormMetadata,
  renderPagestormPage,
} from "./page-content";

export async function generateMetadata(): Promise<Metadata> {
  return generatePagestormMetadata();
}

export default async function PagestormPage() {
  return renderPagestormPage();
}
