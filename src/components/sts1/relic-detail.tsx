"use client";

import Image from "@/components/ui/static-image";
import Link from "next/link";
import { Sts1CardText } from "./description";
import { localizeHref, type ServiceLocale } from "@/lib/i18n";
import { EMPTY_STS1_STATS } from "@/lib/sts1/description";
import { sts1IndexPath, sts1RelicImageUrl } from "@/lib/sts1/paths";
import type { Sts1Relic, Sts1UiLabels } from "@/lib/sts1/types";

export function Sts1RelicDetail({
  relic,
  labels,
  serviceLocale,
}: {
  relic: Sts1Relic;
  labels: Sts1UiLabels;
  serviceLocale: ServiceLocale;
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl gap-6 px-4 py-6">
      <Image
        src={sts1RelicImageUrl(relic)}
        alt={relic.name}
        width={128}
        height={128}
        className="h-32 w-32 shrink-0 object-contain"
      />
      <div>
        <Link
          href={localizeHref(sts1IndexPath("relics"), serviceLocale)}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {labels.relicCollectionTitle}
        </Link>
        <h1 className="mt-3 font-game-title text-2xl text-primary">{relic.name}</h1>
        <p className="text-sm text-muted-foreground">{relic.id}</p>
        <div className="mt-2 flex gap-2 text-xs text-muted-foreground">
          <span>{labels.relicTiers[relic.tier === "deprecated" ? "special" : relic.tier]}</span>
          <span>{relic.pool === "shared" ? labels.shared : labels.characters[relic.pool]}</span>
        </div>
        <Sts1CardText
          text={relic.description}
          stats={EMPTY_STS1_STATS}
          className="mt-4 font-game-text text-sm leading-relaxed"
        />
        {relic.flavor ? (
          <p className="mt-3 text-sm italic text-muted-foreground">{relic.flavor}</p>
        ) : null}
      </div>
    </div>
  );
}
