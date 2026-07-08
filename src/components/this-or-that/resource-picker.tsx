"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import Image from "@/components/ui/static-image";
import type { EntityInfo, EntityType } from "@/components/patch-note-renderer";
import { matchEntities } from "@/lib/chemical-utils";
import { getCharacterColor } from "@/lib/codex-types";
import { useServiceLocale } from "@/hooks/use-service-locale";
import type { GameLocale } from "@/lib/i18n";
import { serviceMessages } from "@/messages/service";
import { ThisOrThatResourcePanel } from "@/components/this-or-that/resource-panel";

function entityTypeLabels(serviceLocale: ReturnType<typeof useServiceLocale>): Partial<Record<EntityType, string>> {
  const codex = serviceMessages[serviceLocale].codex;
  return {
    affliction: codex.afflictions,
    ancient: codex.ancients,
    card: codex.cards,
    character: codex.characters,
    enchantment: codex.enchantments,
    encounter: codex.encounters,
    epoch: codex.epochs,
    event: codex.events,
    keyword: codex.keywords,
    monster: codex.monsters,
    potion: codex.potions,
    power: codex.powers,
    relic: codex.relics,
  };
}

export function ThisOrThatResourcePicker({
  entities,
  label,
  value,
  onChange,
  placeholder,
  exclude,
  gameLocale,
}: {
  entities: EntityInfo[];
  label: string;
  value: EntityInfo | null;
  onChange: (entity: EntityInfo | null) => void;
  placeholder: string;
  exclude?: EntityInfo | null;
  gameLocale: GameLocale;
}) {
  const serviceLocale = useServiceLocale();
  const labels = entityTypeLabels(serviceLocale);
  const [query, setQuery] = useState("");
  const candidates = useMemo(
    () => entities.filter((entity) => (
      !exclude || entity.type !== exclude.type || entity.id !== exclude.id
    )),
    [entities, exclude],
  );
  const matches = useMemo(
    () => matchEntities(query.trim(), candidates, 10),
    [candidates, query],
  );
  const hasQuery = query.trim().length > 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-service text-sm font-semibold text-zinc-300">
          {label}
        </span>
      </div>

      <div className="rounded-lg border border-border bg-card/30">
        {value ? (
          <div className="relative p-2">
            <ThisOrThatResourcePanel
              entity={value}
              sideLabel={label}
              serviceLocale={serviceLocale}
              gameLocale={gameLocale}
              assetOnly
            />
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setQuery("");
              }}
              className="absolute right-3 top-3 z-10 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded bg-black/70 text-muted-foreground transition-colors hover:bg-black hover:text-yellow-300"
              title={serviceLocale === "ko" ? "선택 해제" : "Clear selection"}
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            className="w-full bg-transparent px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-yellow-500/40"
          />
        )}

        {!value && hasQuery && matches.length > 0 && (
          <div className="max-h-72 overflow-y-auto border-t border-border/70">
            {matches.map((entity) => {
              const characterColor = getCharacterColor(entity.color);
              return (
                <button
                  key={`${entity.type}:${entity.id}`}
                  type="button"
                  onClick={() => {
                    onChange(entity);
                    setQuery("");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-yellow-500/10 hover:text-yellow-200"
                >
                  {entity.imageUrl && (
                    <Image
                      src={entity.imageUrl}
                      alt=""
                      width={28}
                      height={28}
                      className="h-7 w-7 shrink-0 rounded object-contain"
                    />
                  )}
                  {characterColor && (
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: characterColor }}
                    />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{entity.nameKo}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {entity.nameEn}
                    </span>
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {labels[entity.type] ?? entity.type}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
