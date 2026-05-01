import { getCodexAncients } from "@/lib/codex-data";
import { getGameLocaleFromSearchRecord } from "@/lib/i18n";
import { AncientList } from "@/components/codex/ancient-list";

export const metadata = {
  title: "에인션트 — 슬서운 이야기",
  description: "슬레이 더 스파이어 2 고대의 존재",
};

export default async function CodexAncientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const gameLocale = getGameLocaleFromSearchRecord(await searchParams);
  const ancients = await getCodexAncients({ gameLocale });

  return <AncientList ancients={ancients} />;
}
