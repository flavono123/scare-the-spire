import type { Metadata } from "next";
import {
  generateThisOrThatPostMetadata,
  renderThisOrThatPostPage,
} from "./page-content";
import { generateStaticDetailShellParams } from "@/lib/static-detail-shell";

export const dynamic = "force-static";
export const generateStaticParams = generateStaticDetailShellParams;

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return generateThisOrThatPostMetadata(id);
}

export default async function ThisOrThatPostPage() {
  return renderThisOrThatPostPage();
}
