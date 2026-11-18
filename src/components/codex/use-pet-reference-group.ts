"use client";

import { useMemo } from "react";
import { useGameLocale } from "@/hooks/use-game-locale";
import { buildCompendiumResourceHref } from "@/lib/compendium-resource-links";
import type { CodexPet } from "@/lib/codex-types";
import type { CodexReferenceGroup } from "./entity-reference-links";
import { useCompendiumData } from "./use-compendium-data";

const PET_KEYS = ["pets"] as const;

/** The pets whose related ids name this resource: the other side of a pet page's rail. */
export function usePetReferenceGroup(kind: keyof CodexPet["related"], id: string): CodexReferenceGroup {
  const pets = useCompendiumData(useGameLocale(), PET_KEYS)?.pets;
  return useMemo(() => ({
    kind: "pet",
    targets: (pets ?? [])
      .filter((pet) => pet.related[kind]?.includes(id))
      .map((pet) => {
        const href = buildCompendiumResourceHref("pet", pet.id);
        // The same entity all-entities.ts builds, so the rail's hover preview shows the pet.
        const entity = { id: pet.id, nameKo: pet.name, nameEn: pet.nameEn, imageUrl: pet.imageUrl, href, color: "pet", type: "pet" as const, petData: pet };
        return { id: pet.id, href, title: pet.name, entity };
      }),
  }), [id, kind, pets]);
}
