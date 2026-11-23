"use client";

import { ComponentProps } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CompendiumViewSwitcher } from "@/components/codex/view-switcher";
import { useHydrationSafeSearchParam } from "@/components/codex/use-hydration-safe-search-param";
import { serviceMessages } from "@/messages/service";
import type { Sts1Intent } from "@/lib/sts1/intents";
import { Sts1IntentLibrary } from "./intent-library";
import { Sts1MonsterLibrary } from "./monster-library";

type BestiaryView = "monsters" | "intents";

/** The STS1 bestiary with STS2's tabs: monsters, intents. */
export function Sts1Bestiary({ intents, ...monsterProps }: ComponentProps<typeof Sts1MonsterLibrary> & { intents: Sts1Intent[] }) {
  const { serviceLocale, labels } = monsterProps;
  const messages = serviceMessages[serviceLocale].codex;
  const pathname = usePathname();
  const router = useRouter();
  const explicitView = useHydrationSafeSearchParam("view");
  const activeView: BestiaryView = explicitView === "intents" ? "intents" : "monsters";
  const setView = (view: BestiaryView) => {
    const params = new URLSearchParams(window.location.search);
    params.set("view", view);
    for (const key of ["monster", "intent"]) params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  };
  const switcher = (
    <CompendiumViewSwitcher<BestiaryView>
      options={[
        { key: "monsters", label: messages.monsters },
        { key: "intents", label: messages.intents },
      ]}
      active={activeView}
      onChange={setView}
    />
  );
  if (activeView === "intents") return <Sts1IntentLibrary intents={intents} labels={labels} serviceLocale={serviceLocale} trailing={switcher} />;
  return <Sts1MonsterLibrary {...monsterProps} trailing={switcher} />;
}
