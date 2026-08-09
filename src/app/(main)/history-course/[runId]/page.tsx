import type { Metadata } from "next";
import {
  generateHistoryCourseRunMetadata,
  renderHistoryCourseRunPage,
} from "./page-content";

type Props = {
  params: Promise<{ runId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { runId } = await params;
  return generateHistoryCourseRunMetadata(undefined, runId);
}

// runId is content-addressable and per-browser; we never enumerate.
// The loader resolves runId from IndexedDB on the client.
export const dynamic = "force-dynamic";

export default async function HistoryCourseRunPage({ params }: Props) {
  const { runId } = await params;
  return renderHistoryCourseRunPage(runId);
}
