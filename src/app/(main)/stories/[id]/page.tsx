import type { Metadata } from "next";
import { generateStoryMetadata, renderStoryPage } from "./page-content";
import { generateStaticDetailShellParams } from "@/lib/static-detail-shell";

export const dynamic = "force-static";
export const generateStaticParams = generateStaticDetailShellParams;

export function generateMetadata(): Metadata {
  return generateStoryMetadata();
}

export default async function StoryPage() {
  return renderStoryPage();
}
