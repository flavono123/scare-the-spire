import type { Metadata } from "next";
import { generateStaticDetailShellParams } from "@/lib/static-detail-shell";
import {
  generateColorfulPhilosopherPostMetadata,
  renderColorfulPhilosopherPostPage,
} from "./page-content";

export const dynamic = "force-static";
export const generateStaticParams = generateStaticDetailShellParams;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return generateColorfulPhilosopherPostMetadata(id);
}

export default function ColorfulPhilosopherPostPage() {
  return renderColorfulPhilosopherPostPage();
}
