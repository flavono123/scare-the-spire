import { Suspense } from "react";
import { getCodexMonsters, getCodexEncounters } from "@/lib/codex-data";
import { MonsterLibrary } from "@/components/codex/monster-library";

export default async function CodexMonstersPage() {
  const [monsters, encounters] = await Promise.all([
    getCodexMonsters(),
    getCodexEncounters(),
  ]);

  return (
    <Suspense>
      <MonsterLibrary monsters={monsters} encounters={encounters} />
    </Suspense>
  );
}
