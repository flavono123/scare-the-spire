"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ServiceLocale } from "@/lib/i18n";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import { serviceMessages } from "@/messages/service";
import type { CodexEncounter, CodexMonster } from "@/lib/codex-types";
import { MonsterLibrary } from "./monster-library";
import { EncounterLibrary } from "./encounter-library";

type BestiaryView = "monsters" | "encounters";

interface BestiaryLibraryProps {
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
  monsters: CodexMonster[];
  encounters: CodexEncounter[];
}

export function BestiaryLibrary({
  serviceLocale,
  gameUi,
  monsters,
  encounters,
}: BestiaryLibraryProps) {
  const messages = serviceMessages[serviceLocale].codex;
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const explicitView = searchParams.get("view");
  const activeView: BestiaryView =
    explicitView === "encounters" || searchParams.has("encounter")
      ? "encounters"
      : "monsters";

  const setView = (view: BestiaryView) => {
    const params = new URLSearchParams(searchParams);
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
        className={`px-2.5 py-1 text-xs font-medium transition-colors ${
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
        className={`px-2.5 py-1 text-xs font-medium transition-colors ${
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
      trailing={switcher}
    />
  );
}
