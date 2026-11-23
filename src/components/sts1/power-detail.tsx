"use client";

import { useRef } from "react";
import Image from "@/components/ui/static-image";
import { CompendiumAssetImageActions } from "@/components/codex/compendium-asset-image-actions";
import { Sts1CommentsRail } from "./comments-rail";
import { Sts1CardText } from "./description";
import { Sts1DetailShell, Sts1EnglishName, Sts1MetaPill } from "./detail-chrome";
import { Sts1RelatedRail } from "./related-rail";
import type { ServiceLocale } from "@/lib/i18n";
import { EMPTY_STS1_STATS } from "@/lib/sts1/description";
import { STS1_POWER_TYPE_COLORS } from "@/lib/sts1/card-style";
import { sts1IndexPath, sts1PowerImageUrl } from "@/lib/sts1/paths";
import type { Sts1RelatedGroup } from "@/lib/sts1/relations";
import type { Sts1Power, Sts1UiLabels } from "@/lib/sts1/types";

export function Sts1PowerDetail({
  power,
  related,
  labels,
  serviceLocale,
  onClose,
}: {
  power: Sts1Power;
  related: readonly Sts1RelatedGroup[];
  labels: Sts1UiLabels;
  serviceLocale: ServiceLocale;
  onClose?: () => void;
}) {
  const assetCopyTargetRef = useRef<HTMLDivElement>(null);
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
      <Sts1RelatedRail groups={related} serviceLocale={serviceLocale} />
      <Sts1CommentsRail
        resourceType="power"
        slug={power.slug}
        serviceLocale={serviceLocale}
      />
    </Sts1DetailShell>
  );
}
