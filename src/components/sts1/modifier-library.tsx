"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "@/components/ui/static-image";
import { FilterSection } from "@/components/codex/codex-filters";
import { useLocalizedHref } from "@/hooks/use-localized-href";
import { fuzzyMatchCodexText } from "@/lib/codex-search";
import type { ServiceLocale } from "@/lib/i18n";
import type { Sts1ModifierRow } from "@/lib/sts1/compendium-extras";
import { sts1DetailPath, sts1IndexPath, sts1RunModUrl } from "@/lib/sts1/paths";
import type { Sts1EntityRefs, Sts1Keyword } from "@/lib/sts1/types";
import { Sts1CommentsRail } from "./comments-rail";
import { Sts1DetailShell, Sts1EnglishName, Sts1HeroTip, Sts1MetaPill } from "./detail-chrome";
import { Sts1EventText } from "./event-text";
import {
  Sts1DetailModal,
  Sts1ListLayout,
  filterButtonClass,
  openOnPlainClick,
  useSts1Selection,
} from "./list-shell";
import { Sts1RelatedRail } from "./related-rail";
import type { Sts1RelatedGroup } from "@/lib/sts1/relations";

export type Sts1ModifierLabels = {
  title: string;
  customMode: string;
  daily: string;
  deprecated: string;
  exclusive: string;
};

/** CustomMod draws `[NAME]` in its color code: b (start), g (helpful), r (harmful). */
const MOD_COLORS: Record<string, string> = { b: "#87ceeb", g: "#7fff00", r: "#ff6563" };

/** Only the daily-mod classes carry an icon; the custom-only mods draw none in the game either. */
function ModIcon({ mod, size }: { mod: Sts1ModifierRow; size: number }) {
  if (!mod.icon) return null;
  return <Image src={sts1RunModUrl(mod.icon)} alt="" width={size} height={size} className="object-contain" style={{ width: size, height: size }} />;
}

function DailyBadge({ label }: { label: string }) {
  return <span className="rounded border border-[#efc851]/50 px-1.5 py-px font-game-text text-[10px] text-[#efc851]">{label}</span>;
}

export function Sts1ModifierDetail({
  mod,
  mods,
  refs,
  related = [],
  keywords,
  modLabels,
  serviceLocale,
  onClose,
}: {
  mod: Sts1ModifierRow;
  mods: readonly Sts1ModifierRow[];
  refs: Sts1EntityRefs;
  related?: readonly Sts1RelatedGroup[];
  keywords: readonly Sts1Keyword[];
  modLabels: Sts1ModifierLabels;
  serviceLocale: ServiceLocale;
  onClose?: () => void;
}) {
  const exclusive = mods.filter((row) => mod.exclusive.includes(row.slug));
  const color = MOD_COLORS[mod.color ?? ""] ?? "#efc851";
  return (
    <Sts1DetailShell
      backHref={sts1IndexPath("modifiers")}
      backLabel={modLabels.title}
      onClose={onClose}
      serviceLocale={serviceLocale}
      heroLayout="icon"
      hero={(
        <div className="flex w-full flex-col items-center gap-4">
          <ModIcon mod={mod} size={128} />
          <Sts1HeroTip title={`[${mod.name}]`} titleColor={color} description={mod.description} keywords={keywords} refs={refs} />
        </div>
      )}
    >
      <section className="rounded-lg border border-border bg-compendium-rail px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {mod.onScreen ? <Sts1MetaPill value={modLabels.customMode} /> : <Sts1MetaPill value={modLabels.deprecated} color="#9ca3af" />}
          {mod.daily ? <Sts1MetaPill value={modLabels.daily} color="#efc851" /> : null}
        </div>
        <div className="mt-3">
          <Sts1EnglishName name={mod.name} nameEn={mod.nameEn} serviceLocale={serviceLocale} />
        </div>
      </section>
      <Sts1RelatedRail
        groups={[
          ...related,
          // Mods the custom-mode screen won't let you pick together with this one.
          ...(exclusive.length ? [{ kind: "modifiers" as const, label: modLabels.exclusive, items: exclusive.map((row) => ({ slug: row.slug, name: row.name })) }] : []),
        ]}
        serviceLocale={serviceLocale}
      />
      <Sts1CommentsRail resourceType="modifier" slug={mod.slug} serviceLocale={serviceLocale} />
    </Sts1DetailShell>
  );
}

export function Sts1ModifierLibrary({
  mods,
  refs,
  related,
  keywords,
  modLabels,
  serviceLocale,
}: {
  mods: Sts1ModifierRow[];
  refs: Sts1EntityRefs;
  related?: Record<string, Sts1RelatedGroup[]>;
  keywords: Sts1Keyword[];
  modLabels: Sts1ModifierLabels;
  serviceLocale: ServiceLocale;
}) {
  const localizeLink = useLocalizedHref();
  const { selected, open, close } = useSts1Selection(mods, "modifier");
  const [dailyOnly, setDailyOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const filtered = useMemo(() => {
    const query = searchQuery.trim();
    return mods.filter((mod) => {
      if (dailyOnly && !mod.daily) return false;
      if (query && !fuzzyMatchCodexText(`${mod.name} ${mod.nameEn} ${mod.description}`, query)) return false;
      return true;
    });
  }, [dailyOnly, mods, searchQuery]);
  const sections = [
    { key: "screen", title: modLabels.customMode, rows: filtered.filter((mod) => mod.onScreen) },
    { key: "deprecated", title: modLabels.deprecated, rows: filtered.filter((mod) => !mod.onScreen) },
  ].filter((section) => section.rows.length > 0);
  return (
    <Sts1ListLayout
      title={modLabels.title}
      count={filtered.length}
      serviceLocale={serviceLocale}
      searchQuery={searchQuery}
      onSearch={setSearchQuery}
      filters={(
        <FilterSection label={serviceLocale === "ko" ? "분류" : "Kind"}>
          <div className="flex flex-col gap-0.5">
            <button onClick={() => setDailyOnly((value) => !value)} className={filterButtonClass(dailyOnly)}>
              {modLabels.daily}
            </button>
          </div>
        </FilterSection>
      )}
      overlay={selected ? (
        <Sts1DetailModal label={selected.name} onClose={close}>
          <Sts1ModifierDetail
            mod={selected}
            mods={mods}
            refs={refs}
            related={related?.[selected.slug]}
            keywords={keywords}
            modLabels={modLabels}
            serviceLocale={serviceLocale}
            onClose={close}
          />
        </Sts1DetailModal>
      ) : null}
    >
      {sections.map((section) => (
        <section key={section.key} className="mb-8 last:mb-0">
          <h2 className="mb-3 font-game-title text-lg font-bold text-primary">
            {section.title}
            <span className="ml-2 font-game-text text-sm font-normal text-gray-400">{section.rows.length}</span>
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {section.rows.map((mod) => (
              <Link
                key={mod.slug}
                prefetch={false}
                href={localizeLink(sts1DetailPath("modifiers", mod.slug))}
                className="group flex items-start gap-3 rounded-lg border border-white/10 bg-black/30 p-3 transition-colors hover:border-primary/50 hover:bg-white/[0.04]"
                aria-label={mod.name}
                onClick={(event) => openOnPlainClick(event, () => open(mod))}
              >
                <ModIcon mod={mod} size={48} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="font-game-title text-sm font-bold" style={{ color: MOD_COLORS[mod.color ?? ""] ?? "#9ca3af" }}>
                      [{mod.name}]
                    </span>
                    {mod.daily ? <DailyBadge label={modLabels.daily} /> : null}
                  </span>
                  <Sts1EventText text={mod.description} className="mt-1 block font-game-text text-xs leading-snug text-gray-300" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </Sts1ListLayout>
  );
}
