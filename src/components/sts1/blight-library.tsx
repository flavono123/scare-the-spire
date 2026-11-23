"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "@/components/ui/static-image";
import { CompendiumAssetImageActions } from "@/components/codex/compendium-asset-image-actions";
import { useLocalizedHref } from "@/hooks/use-localized-href";
import { fuzzyMatchCodexText } from "@/lib/codex-search";
import type { ServiceLocale } from "@/lib/i18n";
import { plainSts1Text } from "@/lib/sts1/description";
import { sts1DetailPath, sts1IndexPath } from "@/lib/sts1/paths";
import type { Sts1Blight, Sts1EntityRefs, Sts1Keyword, Sts1UiLabels } from "@/lib/sts1/types";
import { Sts1CommentsRail } from "./comments-rail";
import { Sts1DetailShell, Sts1EnglishName } from "./detail-chrome";
import { Sts1Description, Sts1DetailModal, Sts1EntryTips, Sts1ListLayout, openOnPlainClick, useSts1Selection } from "./list-shell";
import { RelicSlab } from "./mention-hover";
import { Sts1RelatedRail } from "./related-rail";
import type { Sts1RelatedGroup } from "@/lib/sts1/relations";

function detailText(serviceLocale: ServiceLocale) {
  return serviceLocale === "ko"
    ? { stacked: "쌓였을 때", stackNote: "N: 쌓인 횟수" }
    : { stacked: "When stacked", stackNote: "N: times stacked" };
}

export function Sts1BlightDetail({
  blight,
  refs,
  related = [],
  keywords,
  labels,
  serviceLocale,
  onClose,
}: {
  blight: Sts1Blight;
  refs: Sts1EntityRefs;
  related?: readonly Sts1RelatedGroup[];
  keywords: readonly Sts1Keyword[];
  labels: Sts1UiLabels;
  serviceLocale: ServiceLocale;
  onClose?: () => void;
}) {
  const captureRef = useRef<HTMLDivElement>(null);
  const text = detailText(serviceLocale);
  return (
    <Sts1DetailShell
      backHref={sts1IndexPath("blights")}
      backLabel={labels.listTitles.blights}
      onClose={onClose}
      serviceLocale={serviceLocale}
      heroLayout="icon"
      assetActions={<CompendiumAssetImageActions serviceLocale={serviceLocale} fileName={`${blight.slug}.png`} targetRef={captureRef} />}
      hero={(
        <div>
          {/* SingleRelicViewPopup's panel, as the relic detail popup draws it. */}
          <RelicSlab
            captureRef={captureRef}
            entry={{ nameKo: blight.name, description: blight.description, imageUrl: blight.image, tier: "common", flavor: "" }}
            labels={labels}
            suffix=""
            keywords={keywords}
            tierText={labels.listTitles.blights}
            className="w-[min(22rem,80vw)]"
            tipsInFlow
          />
        </div>
      )}
    >
      <section className="rounded-lg border border-border bg-compendium-rail px-4 py-3">
        <Sts1EnglishName name={blight.name} nameEn={blight.nameEn} serviceLocale={serviceLocale} />
      </section>
      {blight.stackDescription ? (
        <section className="rounded-lg border border-border bg-compendium-rail px-4 py-3">
          <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">{text.stacked}</div>
          <Sts1Description text={blight.stackDescription} keywords={keywords} refs={refs} />
          <p className="mt-2 font-game-text text-xs text-gray-500">{text.stackNote}</p>
        </section>
      ) : null}
      <Sts1RelatedRail groups={related} serviceLocale={serviceLocale} />
      <Sts1CommentsRail resourceType="blight" slug={blight.slug} serviceLocale={serviceLocale} />
    </Sts1DetailShell>
  );
}

export function Sts1BlightLibrary({
  blights,
  refs,
  related,
  keywords,
  labels,
  serviceLocale,
}: {
  blights: Sts1Blight[];
  refs: Sts1EntityRefs;
  related?: Record<string, Sts1RelatedGroup[]>;
  keywords: Sts1Keyword[];
  labels: Sts1UiLabels;
  serviceLocale: ServiceLocale;
}) {
  const localizeLink = useLocalizedHref();
  const { selected, open, close } = useSts1Selection(blights, "blight");
  const [searchQuery, setSearchQuery] = useState("");
  const filtered = useMemo(() => {
    const query = searchQuery.trim();
    return blights.filter((blight) => !query || fuzzyMatchCodexText(`${blight.name} ${blight.nameEn} ${plainSts1Text(blight.description)}`, query));
  }, [blights, searchQuery]);
  return (
    <Sts1ListLayout
      title={labels.listTitles.blights}
      count={filtered.length}
      serviceLocale={serviceLocale}
      searchQuery={searchQuery}
      onSearch={setSearchQuery}
      overlay={selected ? (
        <Sts1DetailModal label={selected.name} onClose={close}>
          <Sts1BlightDetail blight={selected} refs={refs} related={related?.[selected.slug]} keywords={keywords} labels={labels} serviceLocale={serviceLocale} onClose={close} />
        </Sts1DetailModal>
      ) : null}
    >
      <div className="flex flex-wrap gap-1.5">
        {filtered.map((blight) => (
          <Link
            key={blight.slug}
            prefetch={false}
            href={localizeLink(sts1DetailPath("blights", blight.slug))}
            className="group"
            aria-label={blight.name}
            onClick={(event) => openOnPlainClick(event, () => open(blight))}
          >
            <Sts1EntryTips title={blight.name} description={blight.description} keywords={keywords}>
              <article className="relative block">
                <div className="h-14 w-14 rounded-lg border-2 border-transparent bg-white/5 p-1 transition-all sm:h-16 sm:w-16 group-hover:z-10 group-hover:scale-110 group-hover:border-primary/60 group-hover:bg-primary/10">
                  <Image src={blight.image} alt={blight.name} width={64} height={64} className="h-full w-full object-contain" />
                </div>
              </article>
            </Sts1EntryTips>
          </Link>
        ))}
      </div>
    </Sts1ListLayout>
  );
}
