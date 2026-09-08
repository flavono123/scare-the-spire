"use client";

import Image from "@/components/ui/static-image";
import { Sts1CardText } from "./description";
import { Sts1DetailShell, Sts1EnglishName, Sts1MetaPill } from "./detail-chrome";
import type { ServiceLocale } from "@/lib/i18n";
import { EMPTY_STS1_STATS } from "@/lib/sts1/description";
import { STS1_POTION_RARITY_COLORS, sts1PoolColor, sts1PoolOutline } from "@/lib/sts1/card-style";
import { sts1IndexPath, sts1PotionImageUrl } from "@/lib/sts1/paths";
import type { Sts1Potion, Sts1UiLabels } from "@/lib/sts1/types";

export function Sts1PotionDetail({
  potion,
  labels,
  serviceLocale,
  onClose,
}: {
  potion: Sts1Potion;
  labels: Sts1UiLabels;
  serviceLocale: ServiceLocale;
  onClose?: () => void;
}) {
  const poolLabel = potion.pool === "shared" ? labels.shared : labels.characters[potion.pool];
  return (
    <Sts1DetailShell
      backHref={sts1IndexPath("potions")}
      backLabel={labels.potionLabTitle}
      onClose={onClose}
      serviceLocale={serviceLocale}
      heroLayout="icon"
      hero={(
        <div className="flex h-40 w-40 items-center justify-center sm:h-52 sm:w-52">
          <Image
            src={sts1PotionImageUrl(potion)}
            alt={potion.name}
            width={208}
            height={208}
            className="h-full w-full object-contain"
            style={{
              imageRendering: "pixelated",
              filter: sts1PoolOutline(potion.pool),
            }}
          />
        </div>
      )}
    >
      <section className="rounded-lg border border-border bg-compendium-rail px-4 py-3">
        <h1 className="font-game-title text-2xl text-primary">{potion.name}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <Sts1MetaPill
            value={labels.potionRarities[potion.rarity]}
            color={STS1_POTION_RARITY_COLORS[potion.rarity]}
          />
          <Sts1MetaPill value={poolLabel} color={sts1PoolColor(potion.pool)} />
        </div>
        <div className="mt-3">
          <Sts1EnglishName name={potion.name} nameEn={potion.nameEn} serviceLocale={serviceLocale} />
        </div>
      </section>
      <section className="rounded-lg border border-border bg-compendium-rail px-4 py-3">
        <Sts1CardText
          text={potion.description}
          stats={EMPTY_STS1_STATS}
          className="font-game-text text-sm leading-relaxed text-foreground"
        />
      </section>
    </Sts1DetailShell>
  );
}
