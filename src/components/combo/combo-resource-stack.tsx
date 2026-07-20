"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Image from "@/components/ui/static-image";
import { CardTile } from "@/components/codex/card-tile";
import { TinyCardIcon } from "@/components/history-course/card-action-icon";
import { EntityPreview, type EntityInfo } from "@/components/patch-note-renderer";
import { comboResourceKey, type ComboResourceRef } from "@/lib/combo-types";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { serviceMessages } from "@/messages/service";

type ComboResourceStackVariant = "index" | "detail";

interface ComboResourceStackProps {
  resources: ComboResourceRef[];
  entityMap: Map<string, EntityInfo>;
  variant: ComboResourceStackVariant;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
}

type ComboStackStyle = CSSProperties & {
  "--combo-collapsed-x": string;
  "--combo-expanded-x": string;
  "--combo-z": number;
};

function useCoarsePointer(): boolean {
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(hover: none), (pointer: coarse)");
    const update = () => setIsCoarsePointer(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return isCoarsePointer;
}

function ComboResourceAsset({
  entity,
  variant,
  serviceLocale,
}: {
  entity: EntityInfo;
  variant: ComboResourceStackVariant;
  serviceLocale: ServiceLocale;
}) {
  const isIndex = variant === "index";

  if (entity.type === "card" && entity.cardData) {
    if (isIndex) {
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

    return (
      <CardTile
        card={entity.cardData}
        serviceLocale={serviceLocale}
        showUpgrade={false}
        showBeta={false}
        width={96}
        interactive={false}
      />
    );
  }

  if (entity.imageUrl) {
    const imageSize = isIndex ? 52 : 86;
    return (
      <Image
        src={entity.imageUrl}
        alt=""
        width={imageSize}
        height={imageSize}
        className={cn(
          "object-contain drop-shadow-[0_5px_8px_rgba(0,0,0,0.6)]",
          isIndex ? "max-h-[52px] max-w-[52px]" : "max-h-[96px] max-w-[96px]",
        )}
      />
    );
  }

  return (
    <span className={cn(
      "flex items-center justify-center rounded-full border border-yellow-400/25 bg-yellow-500/10 font-game-title font-bold text-yellow-200",
      isIndex ? "h-11 w-11 text-lg" : "h-20 w-20 text-2xl",
    )}>
      {entity.nameKo.slice(0, 1)}
    </span>
  );
}

export function ComboResourceStack({
  resources,
  entityMap,
  variant,
  serviceLocale,
  gameLocale,
}: ComboResourceStackProps) {
  const allEntities = useMemo(
    () => resources
      .map((resource) => entityMap.get(comboResourceKey(resource)))
      .filter((entity): entity is EntityInfo => Boolean(entity)),
    [entityMap, resources],
  );
  const isCoarsePointer = useCoarsePointer();
  const entities = variant === "index" ? allEntities.slice(0, 4) : allEntities;
  const copy = serviceMessages[serviceLocale].combo;

  if (entities.length === 0) return null;

  const isIndex = variant === "index";
  const itemWidth = isIndex ? 64 : 112;
  const itemHeight = isIndex ? 68 : 150;
  const collapsedStep = isIndex ? 12 : 20;
  const expandedStep = isIndex ? 70 : 120;
  const stackWidth = itemWidth + expandedStep * (entities.length - 1);
  const hiddenCount = allEntities.length - entities.length;

  return (
    <div
      className={cn(
        "overflow-x-auto overflow-y-hidden",
        isIndex ? "-mx-1 px-1 py-3" : "-mx-2 px-2 pb-3 pt-5",
      )}
    >
      <div
        role="list"
        data-combo-stack={variant}
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
                isCoarsePointer
                  ? "translate-x-[var(--combo-expanded-x)] -translate-y-1"
                  : "translate-x-[var(--combo-collapsed-x)] group-hover/stack:translate-x-[var(--combo-expanded-x)] group-hover/stack:-translate-y-1 group-focus-within/stack:translate-x-[var(--combo-expanded-x)] group-focus-within/stack:-translate-y-1",
                "hover:!-translate-y-3 hover:!z-50 focus-within:!-translate-y-3 focus-within:!z-50",
              )}
              style={style}
            >
              <EntityPreview
                entity={entity}
                serviceLocale={serviceLocale}
                gameLocale={gameLocale}
                linkClassName="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/80"
              >
                <span
                  className={cn(
                    "relative isolate flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-zinc-800/95 via-zinc-950/95 to-amber-950/35 shadow-[0_8px_20px_rgba(0,0,0,0.48)] ring-1 ring-transparent transition-[border-color,box-shadow,filter] duration-200",
                    "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:bg-[linear-gradient(120deg,transparent_18%,rgba(255,255,255,0.24)_48%,transparent_74%)] after:opacity-0 after:mix-blend-screen after:transition-opacity after:duration-200 group-hover/item:border-yellow-200/45 group-hover/item:ring-yellow-400/25 group-hover/item:shadow-[0_12px_28px_rgba(0,0,0,0.58),0_0_20px_rgba(250,204,21,0.14)] group-hover/item:after:opacity-100 group-focus-within/item:border-yellow-200/45 group-focus-within/item:ring-yellow-400/25 group-focus-within/item:after:opacity-100",
                    isIndex ? "h-16 w-16 p-1.5" : "h-[142px] w-28 p-2",
                  )}
                >
                  <ComboResourceAsset
                    entity={entity}
                    variant={variant}
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
