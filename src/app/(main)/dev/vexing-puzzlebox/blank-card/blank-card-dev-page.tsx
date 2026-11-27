import fs from "fs/promises";
import path from "path";
import sts2Meta from "../../../../../../data/sts2/meta.json";
import { VexingPuzzleboxEffects } from "@/components/vexing-puzzlebox/vexing-puzzlebox-effects";
import { getVexingPuzzleboxGameCopy } from "@/lib/borrowed-game-copy";
import { getCodexCards, getCodexKeywords } from "@/lib/codex-data";
import { isBlankCardAnswer } from "@/lib/blank-card";
import BlankCardGame from "./blank-card-game";

export default async function BlankCardDevPage({ cardId }: { cardId?: string }) {
  const [cards, keywords, gameCopy, characters] = await Promise.all([
    getCodexCards({ gameLocale: "kor" }),
    getCodexKeywords({ gameLocale: "kor" }),
    getVexingPuzzleboxGameCopy("kor"),
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
  // The 짜퍼 effects give the merchant's bubble and the puzzlebox sounds.
  return (
    <VexingPuzzleboxEffects gameCopy={gameCopy}>
      <BlankCardGame
        cards={pool}
        keywords={keywords}
        colorLabels={colorLabels}
        version={sts2Meta.version}
        initialCardId={cardId?.toUpperCase()}
      />
    </VexingPuzzleboxEffects>
  );
}
