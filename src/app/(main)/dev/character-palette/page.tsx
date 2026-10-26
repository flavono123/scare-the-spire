import { notFound } from "next/navigation";

export const metadata = {
  title: "2색 배색 — DEV",
  description: "개발 전용: 2색 배색을 캐릭터·보스·엘리트·고대의 존재 토큰과 닉네임 자리에 적용",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-static";

export default async function CharacterPalettePage() {
  // NODE_ENV is inlined at build time, so production builds drop this branch.
  if (process.env.NODE_ENV === "development") {
    const [
      { getCodexAncients, getCodexCharacters, getCodexEncounters, getCodexMonsters },
      { buildPaletteSubjects },
      { default: CharacterPaletteDevPage },
    ] = await Promise.all([
      import("@/lib/codex-data"),
      import("@/lib/dev-palette-subjects"),
      import("./character-palette-dev-page"),
    ]);
    const [characters, monsters, ancients, encounters] = await Promise.all([
      getCodexCharacters({ gameLocale: "kor" }),
      getCodexMonsters({ gameLocale: "kor" }),
      getCodexAncients({ gameLocale: "kor" }),
      getCodexEncounters({ gameLocale: "kor" }),
    ]);
    const subjects = buildPaletteSubjects({
      characters,
      monsters,
      ancients,
      encounters: encounters.filter((encounter) => encounter.roomType === "Boss"),
    });
    return <CharacterPaletteDevPage subjects={subjects} />;
  }
  notFound();
}
