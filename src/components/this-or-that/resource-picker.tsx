"use client";

import { useMemo, useState } from "react";
import Image from "@/components/ui/static-image";
import type { EntityInfo, EntityType } from "@/components/patch-note-renderer";
import { matchEntities } from "@/lib/chemical-utils";
import { getCharacterColor } from "@/lib/codex-types";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { serviceMessages } from "@/messages/service";

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
}: {
  entities: EntityInfo[];
  label: string;
  value: EntityInfo | null;
  onChange: (entity: EntityInfo) => void;
  placeholder: string;
  exclude?: EntityInfo | null;
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
        {value && (
          <span className="max-w-[70%] truncate font-game-title text-sm text-yellow-300">
            {value.nameKo}
          </span>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card/30">
        {value && (
          <button
            type="button"
            onClick={() => setQuery(value.nameKo)}
            className="flex w-full items-center gap-2 border-b border-border/70 px-3 py-2 text-left transition-colors hover:bg-white/[0.03]"
          >
            {value.imageUrl && (
              <Image
                src={value.imageUrl}
                alt=""
                width={34}
                height={34}
                className="h-8 w-8 shrink-0 rounded object-contain"
              />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-game-title text-sm text-zinc-100">
                {value.nameKo}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {labels[value.type] ?? value.type}
              </span>
            </span>
          </button>
        )}

        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-yellow-500/40"
        />

        {hasQuery && matches.length > 0 && (
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
