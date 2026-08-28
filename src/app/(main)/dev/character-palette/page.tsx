import { notFound } from "next/navigation";
import { getCodexCharacters } from "@/lib/codex-data";

export const metadata = {
  title: "캐릭터 배색 — DEV",
  description: "개발 전용: 2색 배색을 얼굴 토큰과 캐릭터 Spine에 적용",
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

  const characters = await getCodexCharacters({ gameLocale: "kor" });
  const { default: CharacterPaletteDevPage } = await import("./character-palette-dev-page");
  return <CharacterPaletteDevPage characters={characters} />;
}
