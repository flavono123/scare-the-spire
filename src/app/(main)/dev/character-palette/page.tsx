import { notFound } from "next/navigation";
import {
  getCodexAncients,
  getCodexCharacters,
  getCodexEncounters,
  getCodexMonsters,
} from "@/lib/codex-data";
import { buildPaletteSubjects } from "@/lib/dev-palette-subjects";
import { getEncounterMonsterIds } from "@/lib/encounter-compositions";

export const metadata = {
  title: "2색 배색 — DEV",
  description: "개발 전용: 2색 배색을 캐릭터·보스·엘리트·고대의 존재 토큰과 Spine에 적용",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-static";

export default async function CharacterPalettePage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const [characters, monsters, ancients, encounters] = await Promise.all([
    getCodexCharacters({ gameLocale: "kor" }),
    getCodexMonsters({ gameLocale: "kor" }),
    getCodexAncients({ gameLocale: "kor" }),
    getCodexEncounters({ gameLocale: "kor" }),
  ]);
  const bossEncounters = encounters.filter((encounter) => encounter.roomType === "Boss");
  const bossMonsterIds = new Set(bossEncounters.flatMap(getEncounterMonsterIds));
  const subjects = buildPaletteSubjects({
    characters,
    monsters,
    ancients,
    encounters: bossEncounters,
  });
  const { default: CharacterPaletteDevPage } = await import("./character-palette-dev-page");
  return (
    <CharacterPaletteDevPage
      subjects={subjects}
      encounters={bossEncounters}
      monsters={monsters.filter((monster) => bossMonsterIds.has(monster.id))}
    />
  );
}
