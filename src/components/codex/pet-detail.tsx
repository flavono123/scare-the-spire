"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "@/components/ui/static-image";
import { useLocalizedHref } from "@/hooks/use-localized-href";
import { CommentSection } from "@/components/comment-section";
import { buildCodexCommentThreadKey } from "@/lib/comment-threads";
import { getCodexServiceMessages } from "@/lib/codex-service";
import { buildCompendiumResourceHref } from "@/lib/compendium-resource-links";
import type { ServiceLocale } from "@/lib/i18n";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import type { CodexPet } from "@/lib/codex-types";
import { closeOnPlainClick } from "@/lib/plain-click";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { CompendiumAssetImageActions } from "./compendium-asset-image-actions";
import { DescriptionText } from "./codex-description";
import { GameHoverTip } from "./hover-tip";
import { RichDescription } from "./rich-description";
import { RelatedResourceLinks, referenceGroupsFromIds } from "./entity-reference-links";

export function PetInspect({
  pet,
  entities,
  gameUi,
}: {
  pet: CodexPet;
  entities?: EntityInfo[];
  gameUi?: CodexGameUiLabels;
}) {
  const excludeSelf = useMemo(() => new Set([pet.name, pet.nameEn]), [pet.name, pet.nameEn]);
  return (
    <div className="flex w-full max-w-[34rem] flex-col items-center gap-3 sm:flex-row sm:gap-5">
      <Image src={pet.imageUrl} alt={pet.name} width={200} height={200} className="h-48 w-48 shrink-0 object-contain" />
      <GameHoverTip title={pet.name} className="min-w-0 w-full" style={{ minWidth: 0 }}>
        {entities ? (
          <RichDescription
            gameUi={gameUi}
            description={pet.description}
            entities={entities}
            excludeEntityTerms={excludeSelf}
            className="block text-left"
          />
        ) : (
          <DescriptionText description={pet.description} className="block text-left" />
        )}
      </GameHoverTip>
    </div>
  );
}

export function PetDetail({
  serviceLocale,
  gameUi,
  backToListTitle,
  pet,
  pets,
  entities,
  onClose,
}: {
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
  backToListTitle: string;
  pet: CodexPet;
  /** All pets, to name the one it evolves from or into. */
  pets: CodexPet[];
  entities?: EntityInfo[];
  onClose?: () => void;
}) {
  const localizeLink = useLocalizedHref();
  const serviceText = getCodexServiceMessages(serviceLocale);
  const view = serviceText.petsView;
  const assetCopyTargetRef = useRef<HTMLDivElement>(null);
  const [commentCount, setCommentCount] = useState(0);
  const englishName = serviceLocale === "ko" ? "영어명" : "English name";
  const evolution = [
    { label: view.evolvesFrom, pet: pets.find((other) => other.id === pet.evolvesFrom) },
    { label: view.evolvesTo, pet: pets.find((other) => other.id === pet.evolvesTo) },
  ].filter((entry): entry is { label: string; pet: CodexPet } => Boolean(entry.pet));
  const linkClass = "font-game-text text-sm text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary";

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6" data-pet-detail>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          prefetch={onClose ? false : undefined}
          href={localizeLink("/compendium/pets")}
          className="text-sm text-gray-400 transition-colors hover:text-gray-200"
          onClick={(event) => closeOnPlainClick(event, onClose)}
        >
          ← {backToListTitle}
        </Link>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-white/10"
            aria-label={serviceText.common.close}
          >
            ✕
          </button>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] lg:items-start">
        <section className="flex min-h-[18rem] flex-col items-center justify-center gap-2 py-4">
          <div ref={assetCopyTargetRef}>
            <PetInspect pet={pet} entities={entities} gameUi={gameUi} />
          </div>
          <CompendiumAssetImageActions
            serviceLocale={serviceLocale}
            fileName={`${pet.id}.png`}
            targetRef={assetCopyTargetRef}
          />
        </section>

        <aside className="flex flex-col gap-3">
          <section className="rounded-lg border border-border bg-compendium-rail px-4 py-3">
            <div className="space-y-3">
              {pet.source && (
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">{view.source}</div>
                  <Link href={localizeLink(buildCompendiumResourceHref(pet.source.type, pet.source.id))} className={linkClass}>
                    {pet.source.name} →
                  </Link>
                </div>
              )}
              {evolution.map((entry) => (
                <div key={entry.label}>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">{entry.label}</div>
                  <Link href={localizeLink(buildCompendiumResourceHref("pet", entry.pet.id))} className={linkClass}>
                    {entry.pet.name} →
                  </Link>
                  <div className="mt-0.5 text-xs text-muted-foreground">{view.restSiteEvolution}</div>
                </div>
              ))}
              {pet.nameEn !== pet.name && (
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">{englishName}</div>
                  <div className="font-game-text text-sm text-foreground">{pet.nameEn}</div>
                </div>
              )}
            </div>
          </section>

          <RelatedResourceLinks
            gameUi={gameUi}
            groups={referenceGroupsFromIds(pet.related, entities)}
            serviceLocale={serviceLocale}
          />

          <details className="group rounded-lg border border-border bg-compendium-rail px-4 py-3" open>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-game-title text-sm font-bold text-foreground">
              <span>{`${serviceText.common.comments}${commentCount > 0 ? ` (${commentCount})` : ""}`}</span>
              <span className="text-xs text-gray-500 transition-transform group-open:rotate-180">⌄</span>
            </summary>
            <div className="mt-3">
              <CommentSection
                threadKey={buildCodexCommentThreadKey("pet", pet.id)}
                onCountChange={setCommentCount}
              />
            </div>
          </details>
        </aside>
      </div>
    </div>
  );
}
