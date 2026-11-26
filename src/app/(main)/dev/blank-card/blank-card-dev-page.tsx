import fs from "fs/promises";
import path from "path";
import { getCodexCards, getCodexKeywords } from "@/lib/codex-data";
import { isBlankCardAnswer } from "@/lib/blank-card";
import BlankCardGame from "./blank-card-game";

export default async function BlankCardDevPage({ cardId }: { cardId?: string }) {
  const [cards, keywords, characters] = await Promise.all([
    getCodexCards({ gameLocale: "kor" }),
    getCodexKeywords({ gameLocale: "kor" }),
    fs.readFile(path.join(process.cwd(), "data/sts2/kor/characters.json"), "utf-8")
      .then((raw) => JSON.parse(raw) as { id: string; name: string }[]),
  ]);
  const pool = cards.filter(isBlankCardAnswer);
  const colorLabels: Record<string, string> = {
    ...Object.fromEntries(characters.map((c) => [c.id.toLowerCase(), c.name])),
    colorless: "무색",
    curse: "저주",
    token: "토큰",
  };
  return (
    <BlankCardGame
      cards={pool}
      keywordNames={keywords.map((keyword) => keyword.name)}
      colorLabels={colorLabels}
      initialCardId={cardId?.toUpperCase()}
    />
  );
}
