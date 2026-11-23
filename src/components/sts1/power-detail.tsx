"use client";

import { useRef } from "react";
import Image from "@/components/ui/static-image";
import { CompendiumAssetImageActions } from "@/components/codex/compendium-asset-image-actions";
import { Sts1CommentsRail } from "./comments-rail";
import { Sts1DetailShell, Sts1EnglishName, Sts1HeroTip, Sts1MetaPill } from "./detail-chrome";
import { Sts1RelatedRail } from "./related-rail";
import type { ServiceLocale } from "@/lib/i18n";
import { STS1_POWER_TYPE_COLORS } from "@/lib/sts1/card-style";
import { sts1IndexPath, sts1PowerImageUrl } from "@/lib/sts1/paths";
import type { Sts1RelatedGroup } from "@/lib/sts1/relations";
import type { Sts1Keyword, Sts1Power, Sts1UiLabels } from "@/lib/sts1/types";

/** The 128px power art over the PowerTip it shows in combat, keyword tips open. */
export function Sts1PowerDetail({
  power,
  related,
  keywords = [],
  labels,
  serviceLocale,
  onClose,
}: {
  power: Sts1Power;
  related: readonly Sts1RelatedGroup[];
  keywords?: readonly Sts1Keyword[];
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
        <div className="flex w-full flex-col items-center gap-4">
          <div ref={assetCopyTargetRef} className="flex h-32 w-32 items-center justify-center">
            <Image
              src={sts1PowerImageUrl(power)}
              alt={power.name}
              width={128}
              height={128}
              className="h-full w-full object-contain"
              style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.5))" }}
            />
          </div>
          {power.description ? <Sts1HeroTip title={power.name} description={power.description} keywords={keywords} /> : null}
        </div>
      )}
    >
      <section className="rounded-lg border border-border bg-compendium-rail px-4 py-3">
        <div className="flex flex-wrap gap-2">
          <Sts1MetaPill value={labels.powerTypes[power.type]} color={STS1_POWER_TYPE_COLORS[power.type]} />
        </div>
        <div className="mt-3">
          <Sts1EnglishName name={power.name} nameEn={power.nameEn} serviceLocale={serviceLocale} />
        </div>
      </section>
      <Sts1RelatedRail groups={related} serviceLocale={serviceLocale} />
      <Sts1CommentsRail resourceType="power" slug={power.slug} serviceLocale={serviceLocale} />
    </Sts1DetailShell>
  );
}
