import type { Metadata } from "next";
import {
  generateHistoryCourseMetadata,
  renderHistoryCourseIndexPage,
} from "./page-content";

export async function generateMetadata(): Promise<Metadata> {
  return generateHistoryCourseMetadata();
}

export default async function HistoryCourseIndexPage() {
  return renderHistoryCourseIndexPage();
}
