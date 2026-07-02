"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ServiceLocale } from "@/lib/i18n";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import { serviceMessages } from "@/messages/service";
import type {
  CodexAffliction,
  CodexEncounter,
  CodexCard,
  CodexMonster,
  CodexPower,
} from "@/lib/codex-types";
import type { EntityVersionDiff, STS2Change, STS2Patch } from "@/lib/types";
import { MonsterLibrary } from "./monster-library";
import { EncounterLibrary } from "./encounter-library";
import { useHydrationSafeSearchParam } from "./use-hydration-safe-search-param";

type BestiaryView = "monsters" | "encounters";

interface BestiaryLibraryProps {
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
  monsters: CodexMonster[];
  encounters: CodexEncounter[];
  afflictions?: CodexAffliction[];
  cards?: CodexCard[];
  powers?: CodexPower[];
  patches?: STS2Patch[];
  changes?: STS2Change[];
  versions?: string[];
  currentVersion?: string;
  versionDiffs?: EntityVersionDiff[];
}

export function BestiaryLibrary({
  serviceLocale,
  gameUi,
  monsters,
  encounters,
  afflictions,
  cards,
  powers,
  patches,
  changes,
  versions,
  currentVersion,
  versionDiffs,
}: BestiaryLibraryProps) {
  const messages = serviceMessages[serviceLocale].codex;
  const explicitView = useHydrationSafeSearchParam("view");
  const urlEncounterId = useHydrationSafeSearchParam("encounter");
  const pathname = usePathname();
  const router = useRouter();
  const [selectedVersion, setSelectedVersion] = useState(currentVersion ?? "");
  const activeView: BestiaryView =
    explicitView === "encounters" || Boolean(urlEncounterId)
      ? "encounters"
      : "monsters";

  const setView = (view: BestiaryView) => {
    const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
    params.set("view", view);
    if (view === "monsters") {
      params.delete("encounter");
    } else {
      params.delete("monster");
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const switcher = (
    <div className="flex shrink-0 overflow-hidden rounded-md border border-white/10 bg-black/20 p-0.5">
      <button
        type="button"
        onClick={() => setView("monsters")}
        className={`px-2 py-1 text-[11px] font-medium transition-colors sm:px-2.5 sm:text-xs ${
          activeView === "monsters"
            ? "rounded bg-yellow-500/20 text-yellow-300"
            : "text-gray-400 hover:text-gray-200"
        }`}
      >
        {messages.monsters}
      </button>
      <button
        type="button"
        onClick={() => setView("encounters")}
        className={`px-2 py-1 text-[11px] font-medium transition-colors sm:px-2.5 sm:text-xs ${
          activeView === "encounters"
            ? "rounded bg-yellow-500/20 text-yellow-300"
            : "text-gray-400 hover:text-gray-200"
        }`}
      >
        {messages.encounters}
      </button>
    </div>
  );

  if (activeView === "encounters") {
    return (
      <EncounterLibrary
        serviceLocale={serviceLocale}
        gameUi={gameUi}
        title={gameUi.bestiaryTitle}
        encounters={encounters}
        monsters={monsters}
        patches={patches}
        changes={changes}
        versions={versions}
        currentVersion={currentVersion}
        versionDiffs={versionDiffs}
        selectedVersion={selectedVersion}
        onVersionChange={setSelectedVersion}
        trailing={switcher}
      />
    );
  }

  return (
    <MonsterLibrary
      serviceLocale={serviceLocale}
      gameUi={gameUi}
      title={gameUi.bestiaryTitle}
      monsters={monsters}
      encounters={encounters}
      afflictions={afflictions}
      cards={cards}
      powers={powers}
      patches={patches}
      changes={changes}
      versions={versions}
      currentVersion={currentVersion}
      versionDiffs={versionDiffs}
      selectedVersion={selectedVersion}
      onVersionChange={setSelectedVersion}
      trailing={switcher}
    />
  );
}
