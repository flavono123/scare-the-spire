"use client";

import { useRef } from "react";
import Image from "@/components/ui/static-image";
import { CompendiumAssetImageActions } from "@/components/codex/compendium-asset-image-actions";
import { Sts1CommentsRail } from "./comments-rail";
import { Sts1CardText } from "./description";
import { Sts1DetailShell, Sts1EnglishName, Sts1MetaPill } from "./detail-chrome";
import { Sts1ResourceRefLinks } from "./resource-ref-links";
import type { ServiceLocale } from "@/lib/i18n";
import { EMPTY_STS1_STATS } from "@/lib/sts1/description";
import { STS1_POWER_TYPE_COLORS } from "@/lib/sts1/card-style";
import { sts1IndexPath, sts1PowerImageUrl } from "@/lib/sts1/paths";
import type { Sts1Power, Sts1ResourceRef, Sts1UiLabels } from "@/lib/sts1/types";

function relatedLabels(serviceLocale: ServiceLocale) {
  return serviceLocale === "ko"
    ? { cards: "관련 카드", relics: "관련 유물", potions: "관련 포션" }
    : { cards: "Related cards", relics: "Related relics", potions: "Related potions" };
}

export function Sts1PowerDetail({
  power,
  sourceRefs,
  labels,
  serviceLocale,
  onClose,
}: {
  power: Sts1Power;
  sourceRefs: readonly Sts1ResourceRef[];
  labels: Sts1UiLabels;
  serviceLocale: ServiceLocale;
  onClose?: () => void;
}) {
  const assetCopyTargetRef = useRef<HTMLDivElement>(null);
  const related = relatedLabels(serviceLocale);
  return (
    <Sts1DetailShell
      backHref={sts1IndexPath("powers")}
      backLabel={labels.powersTitle}
      onClose={onClose}
      serviceLocale={serviceLocale}
      heroLayout="icon"
      assetActions={(
        <CompendiumAssetImageActions
          serviceLocale={serviceLocale}
          fileName={`${power.slug}.png`}
          targetRef={assetCopyTargetRef}
        />
      )}
      hero={(
        <div ref={assetCopyTargetRef} className="flex h-40 w-40 items-center justify-center sm:h-48 sm:w-48">
          <Image
            src={sts1PowerImageUrl(power)}
            alt={power.name}
            width={192}
            height={192}
            className="h-full w-full object-contain"
            style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.5))" }}
          />
        </div>
      )}
    >
      <section className="rounded-lg border border-border bg-compendium-rail px-4 py-3">
        <h1 className="font-game-title text-2xl text-primary">{power.name}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <Sts1MetaPill value={labels.powerTypes[power.type]} color={STS1_POWER_TYPE_COLORS[power.type]} />
        </div>
        <div className="mt-3">
          <Sts1EnglishName name={power.name} nameEn={power.nameEn} serviceLocale={serviceLocale} />
        </div>
      </section>
      {power.description ? (
        <section className="rounded-lg border border-border bg-compendium-rail px-4 py-3">
          <Sts1CardText
            text={power.description}
            stats={EMPTY_STS1_STATS}
            className="font-game-text text-sm leading-relaxed text-foreground"
          />
        </section>
      ) : null}
      {(["cards", "relics", "potions"] as const).map((type) => (
        <Sts1ResourceRefLinks
          key={type}
          title={related[type]}
          refs={sourceRefs.filter((ref) => ref.type === type)}
          serviceLocale={serviceLocale}
        />
      ))}
      <Sts1CommentsRail
        resourceType="power"
        slug={power.slug}
        serviceLocale={serviceLocale}
      />
    </Sts1DetailShell>
  );
}
