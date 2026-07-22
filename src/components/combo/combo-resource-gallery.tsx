"use client";

import Link from "next/link";
import { CardTile } from "@/components/codex/card-tile";
import type { EntityInfo, EntityType } from "@/components/patch-note-renderer";
import Image from "@/components/ui/static-image";
import {
  buildCompendiumResourceDetailHref,
  type CompendiumResourceLinkType,
} from "@/lib/compendium-resource-links";
import { comboResourceKey, type ComboResourceRef } from "@/lib/combo-types";
import {
  localizeHrefWithGameLocale,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import { serviceMessages } from "@/messages/service";

interface ComboResourceGalleryProps {
  resources: ComboResourceRef[];
  entityMap: Map<string, EntityInfo>;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
}

const DETAIL_LINK_TYPES = new Set<EntityType>([
  "affliction",
  "ancient",
  "card",
  "character",
  "enchantment",
  "encounter",
  "epoch",
  "event",
  "keyword",
  "monster",
  "potion",
  "power",
  "relic",
]);

function getDetailHref(
  entity: EntityInfo,
  serviceLocale: ServiceLocale,
  gameLocale: GameLocale,
): string | null {
  if (entity.availability === "pending-compendium" || entity.href === null) return null;

  let type = entity.type;
  let id = entity.compendiumResourceId ?? entity.id;
  if (type === "monsterMove") {
    type = "monster";
    id = entity.compendiumResourceId ?? entity.monsterMoveMonsterData?.id ?? entity.id;
  }
  if (!DETAIL_LINK_TYPES.has(type)) return entity.href ?? null;

  const href = buildCompendiumResourceDetailHref(
    type as CompendiumResourceLinkType,
    id,
  );
  return localizeHrefWithGameLocale(href, serviceLocale, gameLocale);
}

function LargeResourceAsset({
  entity,
  serviceLocale,
}: {
  entity: EntityInfo;
  serviceLocale: ServiceLocale;
}) {
  const name = serviceLocale === "en" ? entity.nameEn : entity.nameKo;

  if (entity.type === "card" && entity.cardData) {
    return (
      <div className="flex justify-center py-1 sm:py-2">
        <CardTile
          card={entity.cardData}
          serviceLocale={serviceLocale}
          showUpgrade={false}
          showBeta={false}
          width={220}
          interactive={false}
        />
      </div>
    );
  }

  if (entity.type === "event") {
    const imageUrl = entity.eventData?.imageUrl ?? entity.imageUrl;
    if (imageUrl) {
      return (
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black/30 shadow-[0_18px_36px_rgba(0,0,0,0.38)] ring-1 ring-white/10">
          <Image
            src={imageUrl}
            alt={name}
            fill
            sizes="(max-width: 672px) calc(100vw - 5rem), 560px"
            className="object-cover transition-transform duration-200 group-hover/resource:scale-[1.02] motion-reduce:transform-none"
          />
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/[0.04]" />
        </div>
      );
    }
  }

  if (entity.type === "character") {
    const imageUrl = entity.characterData?.combatImageUrl
      ?? entity.characterData?.selectImageUrl
      ?? entity.imageUrl;
    if (imageUrl) {
      return (
        <div className="relative h-72 w-full sm:h-80">
          <Image
            src={imageUrl}
            alt={name}
            fill
            sizes="(max-width: 672px) calc(100vw - 5rem), 560px"
            className="object-contain drop-shadow-[0_22px_28px_rgba(0,0,0,0.58)] transition-transform duration-200 group-hover/resource:scale-[1.02] motion-reduce:transform-none"
          />
        </div>
      );
    }
  }

  if (entity.type === "monster") {
    const imageUrl = entity.monsterData?.imageUrl
      ?? entity.monsterData?.bossImageUrl
      ?? entity.imageUrl;
    if (imageUrl) {
      return (
        <div className="relative h-64 w-full sm:h-72">
          <Image
            src={imageUrl}
            alt={name}
            fill
            sizes="(max-width: 672px) calc(100vw - 5rem), 560px"
            className="object-contain drop-shadow-[0_22px_28px_rgba(0,0,0,0.58)] transition-transform duration-200 group-hover/resource:scale-[1.03] motion-reduce:transform-none"
          />
        </div>
      );
    }
  }

  if (entity.imageUrl) {
    const isWideArt = entity.type === "encounter" || entity.type === "epoch";
    return isWideArt ? (
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-black/20 ring-1 ring-white/10">
        <Image
          src={entity.imageUrl}
          alt={name}
          fill
          sizes="(max-width: 672px) calc(100vw - 5rem), 560px"
          className="object-contain transition-transform duration-200 group-hover/resource:scale-[1.02] motion-reduce:transform-none"
        />
      </div>
    ) : (
      <div className="relative mx-auto h-36 w-36 sm:h-44 sm:w-44">
        <Image
          src={entity.imageUrl}
          alt={name}
          fill
          sizes="176px"
          className="object-contain drop-shadow-[0_14px_18px_rgba(0,0,0,0.55)] transition-transform duration-150 group-hover/resource:scale-110 motion-reduce:transform-none"
        />
      </div>
    );
  }

  return (
    <span className="mx-auto flex h-32 w-32 items-center justify-center font-game-title text-5xl font-bold text-yellow-200 drop-shadow-[0_8px_12px_rgba(0,0,0,0.7)]">
      {name.slice(0, 1)}
    </span>
  );
}

export function ComboResourceGallery({
  resources,
  entityMap,
  serviceLocale,
  gameLocale,
}: ComboResourceGalleryProps) {
  const entities = resources
    .map((resource) => entityMap.get(comboResourceKey(resource)))
    .filter((entity): entity is EntityInfo => Boolean(entity));
  const copy = serviceMessages[serviceLocale].combo;

  if (entities.length === 0) return null;

  return (
    <section
      data-combo-resource-gallery
      aria-label={copy.resourceCountLabel.replace("{count}", String(entities.length))}
      className="divide-y divide-white/[0.06] border-t border-white/[0.06]"
    >
      {entities.map((entity) => {
        const name = serviceLocale === "en" ? entity.nameEn : entity.nameKo;
        const href = getDetailHref(entity, serviceLocale, gameLocale);
        const content = (
          <>
            <h2 className="mb-3 font-game-title text-base font-bold text-yellow-100/90 transition-colors group-hover/resource:text-yellow-300 sm:text-lg">
              {name}
            </h2>
            <LargeResourceAsset entity={entity} serviceLocale={serviceLocale} />
          </>
        );

        return (
          <div
            key={`${entity.type}:${entity.id}`}
            data-combo-resource-detail={entity.type}
            className="py-6 first:pt-5 last:pb-2"
          >
            {href ? (
              <Link
                href={href}
                className="group/resource block rounded-sm outline-none transition-[transform,filter] duration-150 hover:-translate-y-0.5 hover:brightness-110 focus-visible:ring-2 focus-visible:ring-yellow-300/70 active:translate-y-0 motion-reduce:transform-none"
              >
                {content}
              </Link>
            ) : (
              <div>{content}</div>
            )}
          </div>
        );
      })}
    </section>
  );
}
