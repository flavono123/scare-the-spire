"use client";

import { useState } from "react";
import { resolveKnownVersion } from "@/lib/entity-versioning";
import { usePathname, useRouter } from "next/navigation";
import type { ServiceLocale } from "@/lib/i18n";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import { serviceMessages } from "@/messages/service";
import { CompendiumViewSwitcher } from "./view-switcher";
import type {
  CodexAffliction,
  CodexCharacter,
  CodexEncounter,
  CodexCard,
  CodexMonster,
  CodexPower,
} from "@/lib/codex-types";
import type { EntityVersionDiff, STS2Change, STS2Patch } from "@/lib/types";
import { MonsterLibrary } from "./monster-library";
import { EncounterLibrary } from "./encounter-library";
import { IntentLibrary } from "./intent-library";
import type { CodexIntent } from "@/lib/codex-data";
import { useHydrationSafeSearchParam } from "./use-hydration-safe-search-param";
import type { CompendiumDataStatus } from "./use-compendium-data";

type BestiaryView = "monsters" | "encounters" | "intents";

interface BestiaryLibraryProps {
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
  monsters: CodexMonster[];
  characters: CodexCharacter[];
  encounters: CodexEncounter[];
  intents?: CodexIntent[];
  afflictions?: CodexAffliction[];
  cards?: CodexCard[];
  powers?: CodexPower[];
  patches?: STS2Patch[];
  changes?: STS2Change[];
  versions?: string[];
  currentVersion?: string;
  versionDiffs?: EntityVersionDiff[];
  /** Until "loaded", the detail modal shows a loading state or a retry notice. */
  detailsStatus?: CompendiumDataStatus;
}

export function BestiaryLibrary({
  serviceLocale,
  gameUi,
  monsters,
  characters,
  encounters,
  intents = [],
  afflictions,
  cards,
  powers,
  patches,
  changes,
  versions,
  currentVersion,
  versionDiffs,
  detailsStatus = "loaded",
}: BestiaryLibraryProps) {
  const messages = serviceMessages[serviceLocale].codex;
  const explicitView = useHydrationSafeSearchParam("view");
  const urlEncounterId = useHydrationSafeSearchParam("encounter");
  const pathname = usePathname();
  const router = useRouter();
  const urlVersion = useHydrationSafeSearchParam("version");
  const [userSelectedVersion, setUserSelectedVersion] = useState<string | null>(null);
  const selectedVersion = userSelectedVersion
    ?? resolveKnownVersion(urlVersion, versions ?? [])
    ?? (currentVersion ?? "");
  const setSelectedVersion = (v: string) => setUserSelectedVersion(v);
  const activeView: BestiaryView =
    explicitView === "intents"
      ? "intents"
      : explicitView === "encounters" || Boolean(urlEncounterId)
        ? "encounters"
        : "monsters";

  const setView = (view: BestiaryView) => {
    const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
    params.set("view", view);
    if (view === "monsters") {
      params.delete("encounter");
      params.delete("intent");
    } else if (view === "encounters") {
      params.delete("monster");
      params.delete("intent");
    } else {
      params.delete("monster");
      params.delete("encounter");
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const switcher = (
    <CompendiumViewSwitcher<BestiaryView>
      options={[
        { key: "monsters", label: messages.monsters },
        { key: "encounters", label: messages.encounters },
        { key: "intents", label: messages.intents },
      ]}
      active={activeView}
      onChange={setView}
    />
  );

  if (activeView === "intents") {
    return (
      <IntentLibrary
        serviceLocale={serviceLocale}
        title={gameUi.bestiaryTitle}
        countLabel={messages.labels.intents}
        intents={intents}
        monsters={monsters}
        detailsStatus={detailsStatus}
        trailing={switcher}
      />
    );
  }

  if (activeView === "encounters") {
    return (
      <EncounterLibrary
        serviceLocale={serviceLocale}
        gameUi={gameUi}
        title={gameUi.bestiaryTitle}
        encounters={encounters}
        characters={characters}
        monsters={monsters}
        patches={patches}
        changes={changes}
        versions={versions}
        currentVersion={currentVersion}
        versionDiffs={versionDiffs}
        selectedVersion={selectedVersion}
        onVersionChange={setSelectedVersion}
        trailing={switcher}
        detailsStatus={detailsStatus}
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
      detailsStatus={detailsStatus}
    />
  );
}
