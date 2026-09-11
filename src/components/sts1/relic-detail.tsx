"use client";

import Image from "@/components/ui/static-image";
import { Sts1CommentsRail } from "./comments-rail";
import { Sts1CardText } from "./description";
import { Sts1DetailShell, Sts1EnglishName, Sts1MetaPill } from "./detail-chrome";
import type { ServiceLocale } from "@/lib/i18n";
import { EMPTY_STS1_STATS } from "@/lib/sts1/description";
import { STS1_TIER_COLORS, sts1PoolColor } from "@/lib/sts1/card-style";
import { sts1IndexPath, sts1RelicImageUrl } from "@/lib/sts1/paths";
import type { Sts1Relic, Sts1UiLabels } from "@/lib/sts1/types";

export function Sts1RelicDetail({
  relic,
  labels,
  serviceLocale,
  onClose,
}: {
  relic: Sts1Relic;
  labels: Sts1UiLabels;
  serviceLocale: ServiceLocale;
  onClose?: () => void;
}) {
  const tier = relic.tier === "deprecated" ? "special" : relic.tier;
  const poolLabel = relic.pool === "shared" ? labels.shared : labels.characters[relic.pool];
  return (
    <Sts1DetailShell
      backHref={sts1IndexPath("relics")}
      backLabel={labels.relicCollectionTitle}
      onClose={onClose}
      serviceLocale={serviceLocale}
      heroLayout="icon"
      hero={(
        <div className="flex h-40 w-40 items-center justify-center sm:h-48 sm:w-48">
          <Image
            src={sts1RelicImageUrl(relic, relic.hasLargeArt)}
            alt={relic.name}
            width={192}
            height={192}
            className="h-full w-full object-contain"
            style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.5))" }}
          />
        </div>
      )}
    >
      <section className="rounded-lg border border-border bg-compendium-rail px-4 py-3">
        <h1 className="font-game-title text-2xl text-primary">{relic.name}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <Sts1MetaPill value={labels.relicTiers[tier]} color={STS1_TIER_COLORS[tier]} />
          <Sts1MetaPill value={poolLabel} color={sts1PoolColor(relic.pool)} />
        </div>
        <div className="mt-3">
          <Sts1EnglishName name={relic.name} nameEn={relic.nameEn} serviceLocale={serviceLocale} />
        </div>
      </section>
      <section className="rounded-lg border border-border bg-compendium-rail px-4 py-3">
        <Sts1CardText
          text={relic.description}
          stats={EMPTY_STS1_STATS}
          className="font-game-text text-sm leading-relaxed text-foreground"
        />
        {relic.flavor ? (
          <p className="mt-3 font-game-text text-sm italic text-muted-foreground">{relic.flavor}</p>
        ) : null}
      </section>
      <Sts1CommentsRail
        resourceType="relic"
        slug={relic.slug}
        serviceLocale={serviceLocale}
      />
    </Sts1DetailShell>
  );
}
