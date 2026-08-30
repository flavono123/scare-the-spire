import type { Metadata } from "next";
import {
  generateHistoryCourseRunMetadata,
  renderHistoryCourseRunPage,
} from "./page-content";
import { generateStaticHistoryCourseShellParams } from "@/lib/static-detail-shell";

export const dynamic = "force-static";
export const generateStaticParams = generateStaticHistoryCourseShellParams;

type Props = {
  params: Promise<{ runId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { runId } = await params;
  return generateHistoryCourseRunMetadata(undefined, runId);
}

export default async function HistoryCourseRunPage() {
  return renderHistoryCourseRunPage();
}
