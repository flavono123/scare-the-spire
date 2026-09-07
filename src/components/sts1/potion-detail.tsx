"use client";

import Image from "@/components/ui/static-image";
import Link from "next/link";
import { Sts1CardText } from "./description";
import { localizeHref, type ServiceLocale } from "@/lib/i18n";
import { EMPTY_STS1_STATS } from "@/lib/sts1/description";
import { sts1IndexPath, sts1PotionImageUrl } from "@/lib/sts1/paths";
import type { Sts1Potion, Sts1UiLabels } from "@/lib/sts1/types";

export function Sts1PotionDetail({
  potion,
  labels,
  serviceLocale,
}: {
  potion: Sts1Potion;
  labels: Sts1UiLabels;
  serviceLocale: ServiceLocale;
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl gap-6 px-4 py-6">
      <Image
        src={sts1PotionImageUrl(potion)}
        alt={potion.name}
        width={72}
        height={96}
        className="h-24 w-18 shrink-0 object-contain"
      />
      <div>
        <Link
          href={localizeHref(sts1IndexPath("potions"), serviceLocale)}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {labels.potionLabTitle}
        </Link>
        <h1 className="mt-3 font-game-title text-2xl text-primary">{potion.name}</h1>
        <p className="text-sm text-muted-foreground">{potion.id}</p>
        <div className="mt-2 flex gap-2 text-xs text-muted-foreground">
          <span>{labels.potionRarities[potion.rarity]}</span>
          <span>{potion.pool === "shared" ? labels.shared : labels.characters[potion.pool]}</span>
        </div>
        <Sts1CardText
          text={potion.description}
          stats={EMPTY_STS1_STATS}
          className="mt-4 font-game-text text-sm leading-relaxed"
        />
      </div>
    </div>
  );
}
