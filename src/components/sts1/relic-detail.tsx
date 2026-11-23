"use client";

import { useRef } from "react";
import { CompendiumAssetImageActions } from "@/components/codex/compendium-asset-image-actions";
import { Sts1CommentsRail } from "./comments-rail";
import type { Sts1RelatedGroup } from "@/lib/sts1/relations";
import { Sts1RelatedRail } from "./related-rail";
import { Sts1DetailShell, Sts1EnglishName, Sts1MetaPill } from "./detail-chrome";
import { RelicSlab } from "./mention-hover";
import type { ServiceLocale } from "@/lib/i18n";
import { STS1_TIER_COLORS, sts1PoolColor } from "@/lib/sts1/card-style";
import { sts1IndexPath, sts1RelicImageUrl } from "@/lib/sts1/paths";
import type { Sts1Keyword, Sts1Relic, Sts1UiLabels } from "@/lib/sts1/types";

/** SingleRelicViewPopup with the large art, its keyword tips open beside it; the index keeps the small icon. */
export function Sts1RelicDetail({
  relic,
  related = [],
  keywords = [],
  labels,
  serviceLocale,
  onClose,
}: {
  relic: Sts1Relic;
  related?: readonly Sts1RelatedGroup[];
  keywords?: readonly Sts1Keyword[];
  labels: Sts1UiLabels;
  serviceLocale: ServiceLocale;
  onClose?: () => void;
}) {
  const assetCopyTargetRef = useRef<HTMLDivElement>(null);
  const tier = relic.tier === "deprecated" ? "special" : relic.tier;
  const poolLabel = relic.pool === "shared" ? labels.shared : labels.characters[relic.pool];
  return (
    <Sts1DetailShell
      backHref={sts1IndexPath("relics")}
      backLabel={labels.relicCollectionTitle}
      onClose={onClose}
      serviceLocale={serviceLocale}
      heroLayout="icon"
      assetActions={(
        <CompendiumAssetImageActions
          serviceLocale={serviceLocale}
          fileName={`${relic.slug}.png`}
          targetRef={assetCopyTargetRef}
        />
      )}
      hero={(
        <div>
          <RelicSlab
            captureRef={assetCopyTargetRef}
            entry={{
              nameKo: relic.name,
              description: relic.description,
              imageUrl: sts1RelicImageUrl(relic),
              largeImageUrl: relic.hasLargeArt ? sts1RelicImageUrl(relic, true) : undefined,
              tier,
              flavor: relic.flavor,
            }}
            labels={labels}
            suffix={labels.relicPopupSuffix}
            keywords={keywords}
            className="w-[min(22rem,80vw)]"
            tipsInFlow
          />
        </div>
      )}
    >
      <section className="rounded-lg border border-border bg-compendium-rail px-4 py-3">
        <div className="flex flex-wrap gap-2">
          <Sts1MetaPill value={labels.relicTiers[tier]} color={STS1_TIER_COLORS[tier]} />
          <Sts1MetaPill value={poolLabel} color={sts1PoolColor(relic.pool)} />
        </div>
        <div className="mt-3">
          <Sts1EnglishName name={relic.name} nameEn={relic.nameEn} serviceLocale={serviceLocale} />
        </div>
      </section>
      <Sts1RelatedRail groups={related} serviceLocale={serviceLocale} />
      <Sts1CommentsRail resourceType="relic" slug={relic.slug} serviceLocale={serviceLocale} />
    </Sts1DetailShell>
  );
}
