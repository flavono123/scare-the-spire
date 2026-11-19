import { Suspense } from "react";
import type { Metadata } from "next";
import { AchievementLibrary } from "@/components/codex/achievement-library";
import { getCodexAchievements } from "@/lib/codex-data";
import { getCodexMetadata } from "@/lib/codex-service";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const resolved = await searchParams;
  const { title } = await getCodexAchievements({ gameLocale: getGameLocaleFromSearchRecord(resolved) });
  return getCodexMetadata(getServiceLocaleFromSearchRecord(resolved), title, "/compendium/achievements");
}

export default async function CodexAchievementsPage({ searchParams }: PageProps) {
  const resolved = await searchParams;
  const gameLocale = getGameLocaleFromSearchRecord(resolved);
  const { title, achievements } = await getCodexAchievements({ gameLocale });
  return (
    <Suspense>
      <AchievementLibrary
        serviceLocale={getServiceLocaleFromSearchRecord(resolved)}
        title={title}
        achievements={achievements}
      />
    </Suspense>
  );
}
