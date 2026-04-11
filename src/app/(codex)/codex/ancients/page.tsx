import { getCodexAncients } from "@/lib/codex-data";
import { AncientList } from "@/components/codex/ancient-list";

export const metadata = {
  title: "에인션트 — Spire Codex",
  description: "슬레이 더 스파이어 2 고대의 존재",
};

export default async function CodexAncientsPage() {
  const ancients = await getCodexAncients();

  return <AncientList ancients={ancients} />;
}
