"use client";

import { useMemo, type CSSProperties } from "react";
import Image from "@/components/ui/static-image";
import { TinyCardIcon } from "@/components/history-course/card-action-icon";
import { EntityPreview, type EntityInfo } from "@/components/patch-note-renderer";
import {
  COMBO_KEYWORD_IMAGE_URL,
  getComboEncounterMonsterIds,
  getComboEncounterNodeImageUrl,
} from "@/lib/combo-resource-visuals";
import { comboResourceKey, type ComboResourceRef } from "@/lib/combo-types";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { serviceMessages } from "@/messages/service";

interface ComboResourceStackProps {
  resources: ComboResourceRef[];
  entityMap: Map<string, EntityInfo>;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
}

type ComboStackStyle = CSSProperties & {
  "--combo-collapsed-x": string;
  "--combo-expanded-x": string;
  "--combo-z": number;
};

export function ComboResourceAsset({
  entity,
  entityMap,
  serviceLocale,
}: {
  entity: EntityInfo;
  entityMap?: ReadonlyMap<string, EntityInfo>;
  serviceLocale: ServiceLocale;
}) {
  const fallbackName = serviceLocale === "en" ? entity.nameEn : entity.nameKo;

  if (entity.type === "card" && entity.cardData) {
    return (
      <TinyCardIcon
        card={{
          color: entity.cardData.visualColor ?? entity.cardData.color,
          rarity: entity.cardData.rarity,
          type: entity.cardData.type,
        }}
        width={52}
      />
    );
  }

  if (entity.type === "encounter" && entity.encounterData) {
    const monsterImageUrls = getComboEncounterMonsterIds(entity.encounterData)
      .map((monsterId) => entityMap?.get(`monster:${monsterId}`)?.imageUrl)
      .filter((imageUrl): imageUrl is string => Boolean(imageUrl));
    const representativeImageUrls = monsterImageUrls.length > 0
      ? monsterImageUrls
      : entity.imageUrl
        ? [entity.imageUrl]
        : [];

    return (
      <span className="relative block h-[52px] w-14">
        <Image
          src={getComboEncounterNodeImageUrl(entity.encounterData)}
          alt=""
          width={34}
          height={34}
          className={cn(
            "absolute bottom-0 left-0 z-0 h-[34px] w-[34px] object-contain",
            "drop-shadow-[0_3px_5px_rgba(0,0,0,0.8)]",
          )}
        />
        {representativeImageUrls.slice(0, 2).map((imageUrl, index, images) => (
          <Image
            key={`${imageUrl}:${index}`}
            src={imageUrl}
            alt=""
            width={42}
            height={48}
            className={cn(
              "absolute top-0 h-12 w-[42px] object-contain",
              "drop-shadow-[0_5px_8px_rgba(0,0,0,0.7)]",
              images.length === 1
                ? "left-3.5 z-10"
                : index === 0
                  ? "left-1.5 z-10"
                  : "right-0 z-20",
            )}
          />
        ))}
      </span>
    );
  }

  if (entity.type === "keyword") {
    return (
      <Image
        src={COMBO_KEYWORD_IMAGE_URL}
        alt=""
        width={52}
        height={32}
        className="max-h-10 max-w-[52px] object-contain drop-shadow-[0_5px_8px_rgba(0,0,0,0.6)]"
      />
    );
  }

  if (entity.imageUrl) {
    return (
      <Image
        src={entity.imageUrl}
        alt=""
        width={52}
        height={52}
        className="max-h-[52px] max-w-[52px] object-contain drop-shadow-[0_5px_8px_rgba(0,0,0,0.6)]"
      />
    );
  }

  return (
    <span className={cn(
      "flex items-center justify-center font-game-title font-bold text-yellow-200",
      "h-11 w-11 text-lg drop-shadow-[0_3px_5px_rgba(0,0,0,0.8)]",
    )}>
      {fallbackName.slice(0, 1)}
    </span>
  );
}

export function ComboResourceStack({
  resources,
  entityMap,
  serviceLocale,
  gameLocale,
}: ComboResourceStackProps) {
  const allEntities = useMemo(
    () => resources
      .map((resource) => entityMap.get(comboResourceKey(resource)))
      .filter((entity): entity is EntityInfo => Boolean(entity)),
    [entityMap, resources],
  );
  const entities = allEntities.slice(0, 4);
  const copy = serviceMessages[serviceLocale].combo;

  if (entities.length === 0) return null;

  const itemWidth = 62;
  const itemHeight = 66;
  const collapsedStep = 12;
  const expandedStep = 64;
  const stackWidth = itemWidth + expandedStep * (entities.length - 1);
  const hiddenCount = allEntities.length - entities.length;

  return (
    <div className="-mx-1 overflow-x-auto overflow-y-hidden px-1 py-3">
      <div
        role="list"
        data-combo-stack="index"
        aria-label={copy.resourceCountLabel.replace("{count}", String(allEntities.length))}
        className="group/stack relative"
        style={{ width: stackWidth, height: itemHeight }}
      >
        {entities.map((entity, index) => {
          const style: ComboStackStyle = {
            "--combo-collapsed-x": `${collapsedStep * index}px`,
            "--combo-expanded-x": `${expandedStep * index}px`,
            "--combo-z": entities.length - index,
          };

          return (
            <span
              key={`${entity.type}:${entity.id}`}
              role="listitem"
              className={cn(
                "group/item absolute left-0 top-0 z-[var(--combo-z)] block transition-transform duration-300 ease-out motion-reduce:transition-none",
                "translate-x-[var(--combo-collapsed-x)] group-hover/stack:translate-x-[var(--combo-expanded-x)] group-hover/stack:-translate-y-1 group-focus-within/stack:translate-x-[var(--combo-expanded-x)] group-focus-within/stack:-translate-y-1",
                "hover:!-translate-y-3 hover:!z-50 focus-within:!-translate-y-3 focus-within:!z-50",
              )}
              style={style}
            >
              <EntityPreview
                entity={entity}
                serviceLocale={serviceLocale}
                gameLocale={gameLocale}
                linkClassName="block rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/80"
              >
                <span
                  className="relative flex h-16 w-[62px] shrink-0 origin-center items-center justify-center transition-[transform,filter] duration-150 group-hover/item:scale-110 group-hover/item:brightness-125 group-focus-within/item:scale-110 group-focus-within/item:brightness-125 motion-reduce:transform-none"
                >
                  <ComboResourceAsset
                    entity={entity}
                    entityMap={entityMap}
                    serviceLocale={serviceLocale}
                  />
                  <span className="sr-only">
                    {serviceLocale === "en" ? entity.nameEn : entity.nameKo}
                  </span>
                </span>
              </EntityPreview>
            </span>
          );
        })}

        {hiddenCount > 0 && (
          <span
            className="absolute bottom-0 z-[60] rounded-full border border-yellow-400/25 bg-zinc-950/90 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-200 shadow-lg"
            style={{ left: collapsedStep * (entities.length - 1) + itemWidth - 16 }}
            aria-label={copy.moreResourcesLabel.replace("{count}", String(hiddenCount))}
          >
            +{hiddenCount}
          </span>
        )}
      </div>
    </div>
  );
}
