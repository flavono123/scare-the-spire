"use client";

import { useRef } from "react";
import Image from "@/components/ui/static-image";
import { CompendiumAssetImageActions } from "@/components/codex/compendium-asset-image-actions";
import { Sts1CommentsRail } from "./comments-rail";
import type { Sts1RelatedGroup } from "@/lib/sts1/relations";
import { Sts1RelatedRail } from "./related-rail";
import { Sts1DetailShell, Sts1EnglishName, Sts1HeroTip, Sts1MetaPill } from "./detail-chrome";
import type { ServiceLocale } from "@/lib/i18n";
import { STS1_POTION_RARITY_COLORS, sts1PoolColor, sts1PoolOutline } from "@/lib/sts1/card-style";
import { sts1IndexPath, sts1PotionImageUrl } from "@/lib/sts1/paths";
import type { Sts1Keyword, Sts1Potion, Sts1UiLabels } from "@/lib/sts1/types";

/** The potion as the top panel tips it: its sprite over TipHelper's box, keyword tips open. */
export function Sts1PotionDetail({
  potion,
  related = [],
  keywords = [],
  labels,
  serviceLocale,
  onClose,
}: {
  potion: Sts1Potion;
  related?: readonly Sts1RelatedGroup[];
  keywords?: readonly Sts1Keyword[];
  labels: Sts1UiLabels;
  serviceLocale: ServiceLocale;
  onClose?: () => void;
}) {
  const assetCopyTargetRef = useRef<HTMLDivElement>(null);
  const poolLabel = potion.pool === "shared" ? labels.shared : labels.characters[potion.pool];
  return (
    <Sts1DetailShell
      backHref={sts1IndexPath("potions")}
      backLabel={labels.potionLabTitle}
      onClose={onClose}
      serviceLocale={serviceLocale}
      heroLayout="icon"
      assetActions={(
        <CompendiumAssetImageActions
          serviceLocale={serviceLocale}
          fileName={`${potion.slug}.png`}
          targetRef={assetCopyTargetRef}
        />
      )}
      hero={(
        <div className="flex w-full flex-col items-center gap-4">
          <div ref={assetCopyTargetRef} className="flex h-32 w-32 items-center justify-center">
            <Image
              src={sts1PotionImageUrl(potion)}
              alt={potion.name}
              width={128}
              height={128}
              className="h-full w-full object-contain"
              style={{ filter: sts1PoolOutline(potion.pool) }}
            />
          </div>
          <Sts1HeroTip title={potion.name} description={potion.description} keywords={keywords} />
        </div>
      )}
    >
      <section className="rounded-lg border border-border bg-compendium-rail px-4 py-3">
        <div className="flex flex-wrap gap-2">
          <Sts1MetaPill value={labels.potionRarities[potion.rarity]} color={STS1_POTION_RARITY_COLORS[potion.rarity]} />
          <Sts1MetaPill value={poolLabel} color={sts1PoolColor(potion.pool)} />
        </div>
        <div className="mt-3">
          <Sts1EnglishName name={potion.name} nameEn={potion.nameEn} serviceLocale={serviceLocale} />
        </div>
      </section>
      <Sts1RelatedRail groups={related} serviceLocale={serviceLocale} />
      <Sts1CommentsRail resourceType="potion" slug={potion.slug} serviceLocale={serviceLocale} />
    </Sts1DetailShell>
  );
}
