"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "@/components/ui/static-image";
import { useLocalizedHref } from "@/hooks/use-localized-href";
import { fuzzyMatchCodexText } from "@/lib/codex-search";
import type { ServiceLocale } from "@/lib/i18n";
import { sts1DetailPath, sts1IndexPath, sts1UiImageUrl } from "@/lib/sts1/paths";
import type { Sts1RelatedGroup } from "@/lib/sts1/relations";
import type { Sts1Ascension, Sts1EntityRefs, Sts1Keyword, Sts1UiLabels } from "@/lib/sts1/types";
import { Sts1CommentsRail } from "./comments-rail";
import { Sts1DetailShell, Sts1EnglishName, Sts1HeroTip } from "./detail-chrome";
import { Sts1EventText } from "./event-text";
import { Sts1DetailModal, Sts1ListLayout, openOnPlainClick, useSts1Selection } from "./list-shell";
import { Sts1RelatedRail } from "./related-rail";
import { Sts1TipBox } from "./tip-box";

/** The top panel's ascension badge with the level on it, as the stepper draws it. */
export function Sts1AscensionBadge({ level, size }: { level: number; size: number }) {
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <Image src={sts1UiImageUrl("ascension")} alt="" width={size} height={size} className="object-contain" style={{ width: size, height: size }} />
      <span
        className="absolute inset-0 flex items-center justify-center pt-px font-game-title font-black text-white"
        style={{ fontSize: size * 0.36, textShadow: "0 2px 0 #000, 0 0 4px #000" }}
      >
        {level}
      </span>
    </span>
  );
}

export function Sts1AscensionDetail({
  ascension,
  refs,
  related = [],
  keywords = [],
  labels,
  serviceLocale,
  onClose,
}: {
  ascension: Sts1Ascension;
  refs: Sts1EntityRefs;
  related?: readonly Sts1RelatedGroup[];
  keywords?: readonly Sts1Keyword[];
  labels: Sts1UiLabels;
  serviceLocale: ServiceLocale;
  onClose?: () => void;
}) {
  const title = `${labels.monsters.ascension} ${ascension.level}`;
  return (
    <Sts1DetailShell
      backHref={sts1IndexPath("ascensions")}
      backLabel={labels.listTitles.ascensions}
      onClose={onClose}
      serviceLocale={serviceLocale}
      heroLayout="icon"
      hero={(
        <div className="flex w-full flex-col items-center gap-4">
          <Sts1AscensionBadge level={ascension.level} size={128} />
          <Sts1HeroTip title={title} description={ascension.description} keywords={keywords} refs={refs} className="w-full max-w-[22rem]" />
        </div>
      )}
    >
      <section className="rounded-lg border border-border bg-compendium-rail px-4 py-3">
        <Sts1EnglishName name={title} nameEn={`Ascension ${ascension.level}`} serviceLocale={serviceLocale} />
      </section>
      <Sts1RelatedRail groups={related} serviceLocale={serviceLocale} />
      <Sts1CommentsRail resourceType="ascension" slug={ascension.slug} serviceLocale={serviceLocale} />
    </Sts1DetailShell>
  );
}

export function Sts1AscensionList({
  ascensions,
  refs,
  related,
  keywords,
  labels,
  serviceLocale,
}: {
  ascensions: Sts1Ascension[];
  refs: Sts1EntityRefs;
  related?: Record<string, Sts1RelatedGroup[]>;
  keywords?: readonly Sts1Keyword[];
  labels: Sts1UiLabels;
  serviceLocale: ServiceLocale;
}) {
  const localizeLink = useLocalizedHref();
  const { selected, open, close } = useSts1Selection(ascensions, "ascension");
  const [searchQuery, setSearchQuery] = useState("");
  const filtered = useMemo(() => {
    const query = searchQuery.trim();
    return ascensions.filter((row) => !query || fuzzyMatchCodexText(`${row.level} ${row.description}`, query));
  }, [ascensions, searchQuery]);
  return (
    <Sts1ListLayout
      title={labels.listTitles.ascensions}
      count={filtered.length}
      serviceLocale={serviceLocale}
      searchQuery={searchQuery}
      onSearch={setSearchQuery}
      overlay={selected ? (
        <Sts1DetailModal label={`${labels.monsters.ascension} ${selected.level}`} onClose={close}>
          <Sts1AscensionDetail
            ascension={selected}
            refs={refs}
            related={related?.[selected.slug]}
            keywords={keywords}
            labels={labels}
            serviceLocale={serviceLocale}
            onClose={close}
          />
        </Sts1DetailModal>
      ) : null}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        {filtered.map((row) => (
          <Link
            key={row.level}
            prefetch={false}
            href={localizeLink(sts1DetailPath("ascensions", row.slug))}
            onClick={(event) => openOnPlainClick(event, () => open(row))}
            className="group grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2 rounded-lg outline-none transition-transform hover:translate-x-1 focus-visible:ring-2 focus-visible:ring-primary/70"
            data-sts1-ascension={row.level}
          >
            <span className="flex justify-center">
              <Sts1AscensionBadge level={row.level} size={64} />
            </span>
            <Sts1TipBox title={`${labels.monsters.ascension} ${row.level}`}>
              <Sts1EventText text={row.description} />
            </Sts1TipBox>
          </Link>
        ))}
      </div>
    </Sts1ListLayout>
  );
}
