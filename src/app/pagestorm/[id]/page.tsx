import type { Metadata } from "next";
import {
  generatePagestormPostMetadata,
  renderPagestormPostPage,
} from "./page-content";
import { generateStaticDetailShellParams } from "@/lib/static-detail-shell";

export const dynamic = "force-static";
export const generateStaticParams = generateStaticDetailShellParams;

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return generatePagestormPostMetadata(id);
}

export default async function PagestormPostPage() {
  return renderPagestormPostPage();
}
