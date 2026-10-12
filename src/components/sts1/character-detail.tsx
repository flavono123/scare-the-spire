"use client";

import { useRef } from "react";
import Link from "next/link";
import { CompendiumAssetImageActions } from "@/components/codex/compendium-asset-image-actions";
import Image from "@/components/ui/static-image";
import { Sts1CardTile } from "./card-tile";
import { Sts1CommentsRail } from "./comments-rail";
import { Sts1DetailShell, Sts1EnglishName, Sts1MetaPill } from "./detail-chrome";
import { Sts1ResourceRefLinks } from "./resource-ref-links";
import { Sts1SmartText } from "./smart-text";
import { localizeHref, type GameLocale, type ServiceLocale } from "@/lib/i18n";
import { sts1PoolColor } from "@/lib/sts1/card-style";
import { sts1CharacterPortraitUrl, sts1DetailPath, sts1IndexPath } from "@/lib/sts1/paths";
import type {
  Sts1Card,
  Sts1Character,
  Sts1CharacterSelectUi,
  Sts1Keyword,
  Sts1ResourceRef,
  Sts1UiLabels,
} from "@/lib/sts1/types";

function detailLabels(serviceLocale: ServiceLocale) {
  return serviceLocale === "ko"
    ? { startingCards: "시작 카드", startingRelic: "시작 유물", dedicated: "전용 유물, 포션", orbSlots: "구체 슬롯" }
    : { startingCards: "Starting Cards", startingRelic: "Starting Relic", dedicated: "Character Relics & Potions", orbSlots: "Orb slots" };
}

export function Sts1CharacterDetail({
  character,
  deck,
  startingRelics,
  dedicated,
  keywords,
  labels,
  ui,
  serviceLocale,
  gameLocale,
}: {
  character: Sts1Character;
  deck: { card: Sts1Card; count: number }[];
  startingRelics: Sts1ResourceRef[];
  dedicated: Sts1ResourceRef[];
  keywords: readonly Sts1Keyword[];
  labels: Sts1UiLabels;
  ui: Sts1CharacterSelectUi;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
}) {
  const assetCopyTargetRef = useRef<HTMLDivElement>(null);
  const text = detailLabels(serviceLocale);
  const color = sts1PoolColor(character.id);
  return (
    <Sts1DetailShell
      backHref={sts1IndexPath("characters")}
      backLabel={labels.charactersTitle}
      serviceLocale={serviceLocale}
      assetActions={(
        <CompendiumAssetImageActions
          serviceLocale={serviceLocale}
          fileName={`${character.id}.png`}
          targetRef={assetCopyTargetRef}
        />
      )}
      hero={(
        <div ref={assetCopyTargetRef} className="relative w-full overflow-hidden rounded-lg border border-border" style={{ aspectRatio: "16 / 9" }}>
          <Image
            src={sts1CharacterPortraitUrl(character.id)}
            alt={character.name}
            width={1920}
            height={1200}
            priority
            className="absolute left-0 h-auto w-full"
            style={{ top: "-5.5556%" }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/20 to-transparent" />
          <div className="absolute inset-y-0 left-0 flex max-w-[70%] flex-col justify-center gap-3 p-5 sm:p-8">
            <h1 className="font-game-title text-3xl leading-none sm:text-5xl" style={{ color: "#efc851" }}>
              {character.name}
            </h1>
            <Sts1SmartText
              text={character.flavor}
              color="#fff6e2"
              className="font-game-text text-sm leading-relaxed drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] sm:text-base"
            />
          </div>
        </div>
      )}
      stageExtra={(
        <section className="w-full">
          <h2 className="mb-3 font-game-title text-lg font-bold text-foreground">{text.startingCards}</h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            {deck.map(({ card, count }) => (
              <Link
                key={card.id}
                href={localizeHref(sts1DetailPath("cards", card.slug), serviceLocale)}
                className="group relative block"
                title={card.name}
              >
                <Sts1CardTile
                  card={card}
                  keywords={keywords}
                  gameLocale={gameLocale}
                  typeLabel={
                    card.type === "attack" || card.type === "skill" || card.type === "power"
                      || card.type === "curse" || card.type === "status"
                      ? labels.types[card.type]
                      : card.type
                  }
                />
                {count > 1 ? (
                  <span className="absolute right-1 top-1 rounded-md bg-black/75 px-1.5 py-0.5 font-game-text text-xs font-bold text-amber-200">
                    ×{count}
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        </section>
      )}
    >
      <section className="rounded-lg border border-border bg-compendium-rail px-4 py-3">
        <div className="font-game-title text-2xl" style={{ color }}>{character.name}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Sts1MetaPill value={`${ui.hp}${character.hp}/${character.maxHp}`} color="#ff6563" />
          <Sts1MetaPill value={`${ui.gold}${character.gold}`} color="#efc851" />
          {character.maxOrbs > 0 ? <Sts1MetaPill value={`${text.orbSlots} ${character.maxOrbs}`} color="#87ceeb" /> : null}
        </div>
        <div className="mt-3">
          <Sts1EnglishName name={character.name} nameEn={character.nameEn} serviceLocale={serviceLocale} />
        </div>
      </section>
      <Sts1ResourceRefLinks title={text.startingRelic} refs={startingRelics} serviceLocale={serviceLocale} />
      <Sts1ResourceRefLinks title={text.dedicated} refs={dedicated} serviceLocale={serviceLocale} />
      <Sts1CommentsRail resourceType="character" slug={character.slug} serviceLocale={serviceLocale} />
    </Sts1DetailShell>
  );
}
