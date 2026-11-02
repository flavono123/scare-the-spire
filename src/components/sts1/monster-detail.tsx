"use client";

import { useRef } from "react";
import Image from "@/components/ui/static-image";
import { CompendiumAssetImageActions } from "@/components/codex/compendium-asset-image-actions";
import { Sts1CommentsRail } from "./comments-rail";
import { Sts1DetailShell, Sts1EnglishName, Sts1MetaPill } from "./detail-chrome";
import type { ServiceLocale } from "@/lib/i18n";
import { STS1_MONSTER_TYPE_COLORS } from "@/lib/sts1/card-style";
import { sts1IndexPath, sts1MonsterImageUrl } from "@/lib/sts1/paths";
import type { Sts1Monster, Sts1MonsterHitPoints, Sts1UiLabels } from "@/lib/sts1/types";

function hitPointRange({ min, max }: Sts1MonsterHitPoints): string {
  return min === max ? String(min) : `${min}–${max}`;
}

export function Sts1MonsterDetail({
  monster,
  labels,
  serviceLocale,
  onClose,
}: {
  monster: Sts1Monster;
  labels: Sts1UiLabels;
  serviceLocale: ServiceLocale;
  onClose?: () => void;
}) {
  const assetCopyTargetRef = useRef<HTMLDivElement>(null);
  const dungeon = labels.monsters.dungeons[monster.dungeon];
  return (
    <Sts1DetailShell
      backHref={sts1IndexPath("monsters")}
      backLabel={labels.monstersTitle}
      onClose={onClose}
      serviceLocale={serviceLocale}
      heroLayout="icon"
      assetActions={(
        <CompendiumAssetImageActions
          serviceLocale={serviceLocale}
          fileName={`${monster.slug}.png`}
          targetRef={assetCopyTargetRef}
        />
      )}
      hero={(
        <div ref={assetCopyTargetRef} className="flex h-72 w-full max-w-xl items-center justify-center sm:h-96">
          <Image
            src={sts1MonsterImageUrl(monster)}
            alt={monster.name}
            width={640}
            height={384}
            className="max-h-full max-w-full object-contain"
            style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.5))" }}
          />
        </div>
      )}
    >
      <section className="rounded-lg border border-border bg-compendium-rail px-4 py-3">
        <h1 className="font-game-title text-2xl text-primary">{monster.name}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <Sts1MetaPill
            value={labels.monsters.types[monster.type]}
            color={STS1_MONSTER_TYPE_COLORS[monster.type]}
          />
          <Sts1MetaPill value={`${dungeon.act} ${dungeon.name}`} />
        </div>
        <div className="mt-3">
          <Sts1EnglishName name={monster.name} nameEn={monster.nameEn} serviceLocale={serviceLocale} />
        </div>
      </section>
      <section className="rounded-lg border border-border bg-compendium-rail px-4 py-3">
        <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          {labels.monsters.hitPoints}
        </div>
        <dl className="flex flex-col gap-1 font-game-text text-sm text-foreground">
          {monster.hitPoints.map((tier) => (
            <div key={tier.ascension} className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">
                {tier.ascension > 0
                  ? `${labels.monsters.ascension} ${tier.ascension}+`
                  : serviceLocale === "ko" ? "기본" : "Base"}
              </dt>
              <dd className="font-bold">{hitPointRange(tier)}</dd>
            </div>
          ))}
        </dl>
      </section>
      {monster.moves.length > 0 ? (
        <section className="rounded-lg border border-border bg-compendium-rail px-4 py-3">
          <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            {serviceLocale === "ko" ? "행동" : "Moves"}
          </div>
          <ul className="flex flex-wrap gap-2">
            {monster.moves.map((move) => (
              <li key={move}>
                <Sts1MetaPill value={move} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <Sts1CommentsRail
        resourceType="monster"
        slug={monster.slug}
        serviceLocale={serviceLocale}
      />
    </Sts1DetailShell>
  );
}
