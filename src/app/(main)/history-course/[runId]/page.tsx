import { RunDetailLoader } from "@/components/history-course/run-detail-loader";
import { getCodexCards, getCodexRelics } from "@/lib/codex-data";

export const metadata = {
  title: "역사 강의서 — 런",
  description: "내 슬레이 더 스파이어 2 런을 막 맵 위에 그대로 다시 그려봅니다.",
};

// runId is content-addressable and per-browser; we never enumerate.
// The loader resolves runId from IndexedDB on the client.
export const dynamic = "force-dynamic";

export default async function HistoryCourseRunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const [allCards, allRelics] = await Promise.all([
    getCodexCards({ includeDeprecated: true }),
    getCodexRelics(),
  ]);
  return (
    <RunDetailLoader runId={runId} allCards={allCards} allRelics={allRelics} />
  );
}
