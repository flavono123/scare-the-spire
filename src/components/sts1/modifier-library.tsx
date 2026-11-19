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
import { Sts1DetailShell, Sts1EnglishName, Sts1MetaPill } from "./detail-chrome";
import { Sts1EventText } from "./event-text";
import {
  Sts1Description,
  Sts1DetailModal,
  Sts1ListLayout,
  filterButtonClass,
  openOnPlainClick,
  useSts1Selection,
} from "./list-shell";
import { Sts1EntityToken, Sts1ItemRefTokens } from "./ref-token";

export type Sts1ModifierLabels = {
  title: string;
  customMode: string;
  daily: string;
  offScreen: string;
  exclusive: string;
};

/** CustomMod draws `[NAME]` in its color code: b (start), g (helpful), r (harmful). */
const MOD_COLORS: Record<string, string> = { b: "#87ceeb", g: "#7fff00", r: "#ff6563" };

function ModIcon({ mod, size }: { mod: Sts1ModifierRow; size: number }) {
  if (!mod.icon) {
    return <span className="inline-block rounded-md bg-white/5" style={{ width: size, height: size }} aria-hidden />;
  }
  return <Image src={sts1RunModUrl(mod.icon)} alt="" width={size} height={size} className="object-contain" style={{ width: size, height: size }} />;
}

function DailyBadge({ label }: { label: string }) {
  return <span className="rounded border border-[#efc851]/50 px-1.5 py-px font-game-text text-[10px] text-[#efc851]">{label}</span>;
}

export function Sts1ModifierDetail({
  mod,
  mods,
  refs,
  keywords,
  modLabels,
  serviceLocale,
  onClose,
}: {
  mod: Sts1ModifierRow;
  mods: readonly Sts1ModifierRow[];
  refs: Sts1EntityRefs;
  keywords: readonly Sts1Keyword[];
  modLabels: Sts1ModifierLabels;
  serviceLocale: ServiceLocale;
  onClose?: () => void;
}) {
  const localizeLink = useLocalizedHref();
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
        <div className="flex flex-col items-center gap-3">
          <ModIcon mod={mod} size={128} />
          <div className="font-game-title text-2xl [text-shadow:0_2px_0_#000]" style={{ color }}>[{mod.name}]</div>
        </div>
      )}
    >
      <section className="rounded-lg border border-border bg-compendium-rail px-4 py-3">
        <h1 className="font-game-title text-2xl" style={{ color }}>{mod.name}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          {mod.onScreen ? <Sts1MetaPill value={modLabels.customMode} /> : <Sts1MetaPill value={modLabels.offScreen} color="#9ca3af" />}
          {mod.daily ? <Sts1MetaPill value={modLabels.daily} color="#efc851" /> : null}
        </div>
        <div className="mt-3">
          <Sts1EnglishName name={mod.name} nameEn={mod.nameEn} serviceLocale={serviceLocale} />
        </div>
      </section>
      <section className="rounded-lg border border-border bg-compendium-rail px-4 py-3">
        <Sts1Description text={mod.description} keywords={keywords} refs={refs} />
        {mod.refs.length || mod.blightRefs.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {mod.refs.map((item, index) => <Sts1ItemRefTokens key={index} item={item} refs={refs} />)}
            {mod.blightRefs.map((id) => <Sts1EntityToken key={id} type="blight" id={id} refs={refs} />)}
          </div>
        ) : null}
      </section>
      {exclusive.length ? (
        <section className="rounded-lg border border-border bg-compendium-rail px-4 py-3">
          <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">{modLabels.exclusive}</div>
          <div className="flex flex-wrap gap-1.5">
            {exclusive.map((row) => (
              <Link
                key={row.slug}
                prefetch={false}
                href={localizeLink(sts1DetailPath("modifiers", row.slug))}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-black/30 px-1.5 py-0.5 font-game-text text-xs hover:brightness-125"
                style={{ color: MOD_COLORS[row.color ?? ""] ?? "#efc851" }}
              >
                <ModIcon mod={row} size={22} />
                {row.name}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
      <Sts1CommentsRail resourceType="modifier" slug={mod.slug} serviceLocale={serviceLocale} />
    </Sts1DetailShell>
  );
}

export function Sts1ModifierLibrary({
  mods,
  refs,
  keywords,
  modLabels,
  serviceLocale,
}: {
  mods: Sts1ModifierRow[];
  refs: Sts1EntityRefs;
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
    { key: "off", title: modLabels.offScreen, rows: filtered.filter((mod) => !mod.onScreen) },
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
