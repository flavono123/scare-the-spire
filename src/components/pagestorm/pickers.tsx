"use client";

import { useMemo, useState } from "react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { DecisionsDecisionsPoolPicker } from "@/components/decisions-decisions/decisions-decisions-pool-picker";
import { GameScrollArea } from "@/components/game-scroll-area";
import { OwnPostMark } from "@/components/own-post-mark";
import { ServiceModalFrame } from "@/components/service-modal-frame";
import { useGameLocale } from "@/hooks/use-game-locale";
import { useServiceLocale } from "@/hooks/use-service-locale";
import {
  emptyFilterDims,
  toggleFilterDim,
  type DecisionsFilterDim,
  type DecisionsFilterDims,
  type DecisionsPoolMajor,
} from "@/lib/decisions-decisions";
import type { CodexLabelKey, NavDropdownItem } from "@/lib/site-nav-items";
import {
  getToyBoxNavItems,
  localizeCodexNavItems,
  sts2NavItems,
} from "@/lib/site-nav-items";
import { PAGESTORM_HREF } from "@/lib/pagestorm";
import { serviceMessages } from "@/messages/service";
import { mockButtonClass } from "./figures";
import { NavTokenChip } from "./nav-tokens";
import type { CardPresentation } from "./sample";
import {
  filterToyboxPosts,
  type PagestormToyboxPost,
} from "./toybox-samples";

const LABEL_TO_MAJOR: Partial<Record<CodexLabelKey, DecisionsPoolMajor>> = {
  characters: "character",
  cards: "card",
  relics: "relic",
  potions: "potion",
  powers: "power",
  enchantments: "enchantment",
  monsters: "monster",
  events: "event",
  ancients: "ancient",
  epochs: "epoch",
  keywords: "keyword",
  ascensions: "ascension",
  modifiers: "modifier",
};

export function majorFromCodexHref(href: string): DecisionsPoolMajor | null {
  const path = href.replace(/^\/(?:en)(?=\/)/, "");
  const item = sts2NavItems.find((nav) => nav.href === path);
  if (!item) return null;
  return LABEL_TO_MAJOR[item.labelKey] ?? null;
}

export type CompendiumInsertPayload = {
  entity: EntityInfo;
  presentation: CardPresentation;
  beta: boolean;
};

export function CompendiumPickerModal({
  entities,
  initialMajor,
  onClose,
  onInsert,
}: {
  entities: EntityInfo[];
  initialMajor: DecisionsPoolMajor | null;
  onClose: () => void;
  onInsert: (payload: CompendiumInsertPayload) => void;
}) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].pagestorm;
  const [major, setMajor] = useState<DecisionsPoolMajor | null>(initialMajor);
  const [dims, setDims] = useState<DecisionsFilterDims>(() => emptyFilterDims());
  const entityMap = useMemo(
    () => new Map(entities.map((entity) => [`${entity.type}:${entity.id}`, entity])),
    [entities],
  );

  return (
    <ServiceModalFrame
      title={copy.imageInsert.replace("{name}", copy.assetSection)}
      titleId="pagestorm-compendium-picker"
      closeLabel={copy.close}
      onClose={onClose}
      panelClassName="max-h-[min(92dvh,52rem)] w-full max-w-3xl"
    >
      <DecisionsDecisionsPoolPicker
        entities={entities}
        entityMap={entityMap}
        serviceLocale={serviceLocale}
        presetLabels={{}}
        showPresets={false}
        showCatalog
        catalogNeedTypeLabel={copy.pickerNeedType}
        catalogEmptyLabel={copy.pickerEmpty}
        searchPlacement="top"
        major={major}
        dims={dims}
        onMajor={(next) => {
          setMajor(next);
          setDims(emptyFilterDims());
        }}
        onToggleDim={(dim: DecisionsFilterDim, key: string) => {
          setDims((current) => toggleFilterDim(current, dim, key));
        }}
        onPreset={() => undefined}
        onAdd={(entity) => {
          onInsert({
            entity,
            presentation: entity.type === "card" ? "tile" : "art",
            beta: false,
          });
        }}
      />
    </ServiceModalFrame>
  );
}

export function ToyboxPickerModal({
  initialServiceHref,
  onClose,
  onInsert,
}: {
  initialServiceHref: string | null;
  onClose: () => void;
  onInsert: (post: PagestormToyboxPost) => void;
}) {
  const serviceLocale = useServiceLocale();
  const gameLocale = useGameLocale();
  const copy = serviceMessages[serviceLocale].pagestorm;
  const toyboxItems = useMemo(
    () => getToyBoxNavItems({ serviceLocale, gameLocale }).filter(
      (item) => !item.href.startsWith("/dev") && item.href !== PAGESTORM_HREF,
    ),
    [gameLocale, serviceLocale],
  );
  const [serviceHref, setServiceHref] = useState<string | null>(initialServiceHref);
  const [query, setQuery] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const posts = useMemo(() => {
    const matched = filterToyboxPosts({ serviceHref, query });
    return mineOnly ? matched.filter((post) => post.own) : matched;
  }, [mineOnly, query, serviceHref]);

  return (
    <ServiceModalFrame
      title={copy.imageInsert.replace("{name}", copy.toyboxSection)}
      titleId="pagestorm-toybox-picker"
      closeLabel={copy.close}
      onClose={onClose}
      panelClassName="max-h-[min(92dvh,52rem)] w-full max-w-2xl"
    >
      <div className="flex flex-wrap gap-1.5 pb-3">
        {toyboxItems.map((item) => (
          <NavTokenChip
            key={item.href}
            item={item}
            pressed={serviceHref === item.href}
            onClick={() => setServiceHref(serviceHref === item.href ? null : item.href)}
          />
        ))}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={copy.searchPosts}
          className="min-w-0 flex-1 rounded-md border border-border bg-transparent px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          className={mockButtonClass(mineOnly)}
          onClick={() => setMineOnly((current) => !current)}
        >
          {copy.ownFirst}
        </button>
      </div>
      <GameScrollArea className="max-h-[min(60dvh,32rem)]">
        {posts.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-muted-foreground">{copy.emptyToybox}</p>
        ) : (
          <ul className="space-y-2">
            {posts.map((post) => (
              <li key={post.id}>
                <button
                  type="button"
                  className="flex w-full flex-col gap-1 rounded-lg border border-border px-3 py-2 text-left hover:border-primary/50"
                  onClick={() => onInsert(post)}
                >
                  <span className="flex items-center gap-2">
                    <span className="font-game-title text-sm">{post.title}</span>
                    {post.own ? <OwnPostMark /> : null}
                  </span>
                  <span className="line-clamp-2 text-xs text-muted-foreground">{post.body}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </GameScrollArea>
    </ServiceModalFrame>
  );
}

export function useCompendiumNavItems(): NavDropdownItem[] {
  const serviceLocale = useServiceLocale();
  const gameLocale = useGameLocale();
  return useMemo(
    () => localizeCodexNavItems(sts2NavItems, serviceLocale, gameLocale, { useGameLabels: true }),
    [gameLocale, serviceLocale],
  );
}

export function useToyboxNavItems(): NavDropdownItem[] {
  const serviceLocale = useServiceLocale();
  const gameLocale = useGameLocale();
  return useMemo(
    () => getToyBoxNavItems({ serviceLocale, gameLocale }).filter(
      (item) => !item.href.startsWith("/dev") && item.href !== PAGESTORM_HREF,
    ),
    [gameLocale, serviceLocale],
  );
}
