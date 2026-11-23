"use client";

import { ComponentProps } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CompendiumViewSwitcher } from "@/components/codex/view-switcher";
import { useHydrationSafeSearchParam } from "@/components/codex/use-hydration-safe-search-param";
import { serviceMessages } from "@/messages/service";
import type { Sts1Encounter } from "@/lib/sts1/encounters";
import type { Sts1Intent } from "@/lib/sts1/intents";
import type { Sts1RelatedGroup } from "@/lib/sts1/relations";
import type { Sts1Monster } from "@/lib/sts1/types";
import { Sts1EncounterLibrary } from "./encounter-library";
import { Sts1IntentLibrary } from "./intent-library";
import { Sts1MonsterLibrary } from "./monster-library";

type BestiaryView = "monsters" | "encounters" | "intents";

/** The STS1 bestiary with STS2's tabs: monsters, encounters, intents. */
export function Sts1Bestiary({
  intents,
  encounters,
  encounterRelated,
  player,
  ...monsterProps
}: ComponentProps<typeof Sts1MonsterLibrary> & {
  intents: Sts1Intent[];
  encounters: Sts1Encounter[];
  encounterRelated: Record<string, Sts1RelatedGroup[]>;
  player: Sts1Monster | null;
}) {
  const { serviceLocale, labels } = monsterProps;
  const messages = serviceMessages[serviceLocale].codex;
  const pathname = usePathname();
  const router = useRouter();
  const explicitView = useHydrationSafeSearchParam("view");
  const urlEncounter = useHydrationSafeSearchParam("encounter");
  const activeView: BestiaryView = explicitView === "intents"
    ? "intents"
    : explicitView === "encounters" || urlEncounter ? "encounters" : "monsters";
  const setView = (view: BestiaryView) => {
    const params = new URLSearchParams(window.location.search);
    params.set("view", view);
    for (const key of ["monster", "encounter", "intent"]) params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
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
  if (activeView === "encounters") {
    return <Sts1EncounterLibrary encounters={encounters} related={encounterRelated} monsters={monsterProps.monsters} player={player} labels={labels} serviceLocale={serviceLocale} trailing={switcher} />;
  }
  if (activeView === "intents") return <Sts1IntentLibrary intents={intents} labels={labels} serviceLocale={serviceLocale} trailing={switcher} />;
  return <Sts1MonsterLibrary {...monsterProps} trailing={switcher} />;
}
