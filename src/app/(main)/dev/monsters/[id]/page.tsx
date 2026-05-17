import { notFound } from "next/navigation";
import {
  BESTIARY_DEV_MONSTER_GROUPS,
  getBestiaryDevMonsterGroup,
} from "@/lib/bestiary-monster-policy";
import { getCodexMonsters } from "@/lib/codex-data";
import { DevMonsterSpinePreview } from "./dev-monster-spine-preview";

export const metadata = {
  title: "몬스터 미리보기 — DEV",
  robots: {
    index: false,
    follow: false,
  },
};

export async function generateStaticParams() {
  const petGroup = BESTIARY_DEV_MONSTER_GROUPS.find((group) => group.id === "pet");
  return (petGroup?.monsterIds ?? []).map((id) => ({ id: id.toLowerCase() }));
}

export default async function DevMonsterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const { id } = await params;
  const monsters = await getCodexMonsters({ gameLocale: "kor" });
  const monster = monsters.find((item) => item.id.toLowerCase() === id.toLowerCase());
  if (!monster) notFound();

  const group = getBestiaryDevMonsterGroup(monster.id);
  if (group?.id !== "pet") notFound();

  return <DevMonsterSpinePreview monster={monster} />;
}
