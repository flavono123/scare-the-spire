"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "@/components/ui/static-image";
import { FilterSection } from "@/components/codex/codex-filters";
import { useLocalizedHref } from "@/hooks/use-localized-href";
import { fuzzyMatchCodexText } from "@/lib/codex-search";
import type { ServiceLocale } from "@/lib/i18n";
import { plainSts1Text } from "@/lib/sts1/description";
import { sts1DetailPath, sts1OrbImageUrl } from "@/lib/sts1/paths";
import type { Sts1CompendiumKeyword, Sts1EntityRefs, Sts1Keyword, Sts1KeywordKind, Sts1UiLabels } from "@/lib/sts1/types";
import { Sts1CommentsRail } from "./comments-rail";
import { Sts1DetailShell, Sts1EnglishName, Sts1MetaPill } from "./detail-chrome";
import { Sts1EventText } from "./event-text";
import {
  Sts1Description,
  Sts1DetailModal,
  Sts1ListLayout,
  filterButtonClass,
  openOnPlainClick,
  toggled,
  useSts1Selection,
} from "./list-shell";
import { Sts1RelatedRail } from "./related-rail";
import type { Sts1RelatedGroup } from "@/lib/sts1/relations";
import { Sts1TipBox } from "./tip-box";

const KIND_ORDER: Sts1KeywordKind[] = ["keyword", "orb", "stance"];
export type Sts1KeywordKindLabels = Record<Sts1KeywordKind, string>;

/** Orb art, or the stance's aura color where the game draws no icon. */
export function Sts1KeywordIcon({ keyword, size }: { keyword: Sts1CompendiumKeyword; size: number }) {
  if (keyword.image) {
    return <Image src={sts1OrbImageUrl(keyword.image)} alt="" width={size} height={size} className="object-contain" style={{ width: size, height: size }} />;
  }
  if (keyword.color) {
    return (
      <span
        aria-hidden
        className="inline-block rounded-full"
        style={{ width: size, height: size, background: `radial-gradient(circle, ${keyword.color} 0%, ${keyword.color} 35%, transparent 70%)` }}
      />
    );
  }
  return null;
}

export function Sts1KeywordDetail({
  keyword,
  refs,
  related = [],
  kinds,
  keywords,
  labels,
  serviceLocale,
  onClose,
}: {
  keyword: Sts1CompendiumKeyword;
  refs: Sts1EntityRefs;
  related?: readonly Sts1RelatedGroup[];
  kinds: Sts1KeywordKindLabels;
  keywords: readonly Sts1Keyword[];
  labels: Sts1UiLabels;
  serviceLocale: ServiceLocale;
  onClose?: () => void;
}) {
  return (
    <Sts1DetailShell
      backHref="/compendium/sts1/keywords"
      backLabel={labels.listTitles.keywords}
      onClose={onClose}
      serviceLocale={serviceLocale}
      heroLayout="icon"
      hero={(
        <Sts1TipBox
          title={keyword.name}
          icon={keyword.image || keyword.color ? <Sts1KeywordIcon keyword={keyword} size={48} /> : undefined}
          className="w-full max-w-[26rem]"
        >
          <Sts1Description text={keyword.description} keywords={keywords.filter((row) => row.id !== keyword.id)} refs={refs} className="block" />
        </Sts1TipBox>
      )}
    >
      <section className="rounded-lg border border-border bg-compendium-rail px-4 py-3">
        <h1 className="font-game-title text-2xl text-primary">{keyword.name}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <Sts1MetaPill value={kinds[keyword.kind]} />
        </div>
        {keyword.names.length > 1 ? (
          <p className="mt-3 font-game-text text-xs text-muted-foreground">{keyword.names.join(", ")}</p>
        ) : null}
        <div className="mt-3">
          <Sts1EnglishName name={keyword.name} nameEn={keyword.nameEn} serviceLocale={serviceLocale} />
        </div>
      </section>
      <Sts1RelatedRail groups={related} serviceLocale={serviceLocale} />
      <Sts1CommentsRail resourceType="keyword" slug={keyword.slug} serviceLocale={serviceLocale} />
    </Sts1DetailShell>
  );
}

export function Sts1KeywordLibrary({
  rows,
  refs,
  related,
  kinds,
  keywords,
  labels,
  serviceLocale,
}: {
  rows: Sts1CompendiumKeyword[];
  refs: Sts1EntityRefs;
  related?: Record<string, Sts1RelatedGroup[]>;
  kinds: Sts1KeywordKindLabels;
  keywords: Sts1Keyword[];
  labels: Sts1UiLabels;
  serviceLocale: ServiceLocale;
}) {
  const localizeLink = useLocalizedHref();
  const { selected, open, close } = useSts1Selection(rows, "keyword");
  const [kindFilter, setKindFilter] = useState<Set<Sts1KeywordKind>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const filtered = useMemo(() => {
    const query = searchQuery.trim();
    return rows.filter((row) => {
      if (kindFilter.size && !kindFilter.has(row.kind)) return false;
      if (query && !fuzzyMatchCodexText(`${row.names.join(" ")} ${row.nameEn} ${plainSts1Text(row.description)}`, query)) return false;
      return true;
    });
  }, [kindFilter, rows, searchQuery]);
  return (
    <Sts1ListLayout
      title={labels.listTitles.keywords}
      count={filtered.length}
      serviceLocale={serviceLocale}
      searchQuery={searchQuery}
      onSearch={setSearchQuery}
      filters={(
        <FilterSection label={serviceLocale === "ko" ? "분류" : "Kind"}>
          <div className="flex flex-col gap-0.5">
            {KIND_ORDER.map((kind) => (
              <button key={kind} onClick={() => setKindFilter((previous) => toggled(previous, kind))} className={filterButtonClass(kindFilter.has(kind))}>
                {kinds[kind]}
              </button>
            ))}
          </div>
        </FilterSection>
      )}
      overlay={selected ? (
        <Sts1DetailModal label={selected.name} onClose={close}>
          <Sts1KeywordDetail keyword={selected} refs={refs} related={related?.[selected.slug]} kinds={kinds} keywords={keywords} labels={labels} serviceLocale={serviceLocale} onClose={close} />
        </Sts1DetailModal>
      ) : null}
    >
      {KIND_ORDER.filter((kind) => filtered.some((row) => row.kind === kind)).map((kind) => {
        const group = filtered.filter((row) => row.kind === kind);
        return (
          <section key={kind} className="mb-8 last:mb-0">
            <h2 className="mb-3 font-game-title text-lg font-bold text-primary">
              {kinds[kind]}
              <span className="ml-2 font-game-text text-sm font-normal text-gray-400">{group.length}</span>
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {group.map((row) => (
                <Link
                  key={row.slug}
                  prefetch={false}
                  href={localizeLink(sts1DetailPath("keywords", row.slug))}
                  className="group block h-full transition-transform hover:-translate-y-0.5"
                  aria-label={row.name}
                  onClick={(event) => openOnPlainClick(event, () => open(row))}
                >
                  <Sts1TipBox
                    title={row.name}
                    icon={row.image || row.color ? <Sts1KeywordIcon keyword={row} size={40} /> : undefined}
                    className="h-full min-h-28 group-hover:brightness-110"
                  >
                    <Sts1EventText text={row.description} className="line-clamp-3 block" />
                  </Sts1TipBox>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </Sts1ListLayout>
  );
}
