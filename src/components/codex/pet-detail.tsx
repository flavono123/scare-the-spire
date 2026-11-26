"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLocalizedHref } from "@/hooks/use-localized-href";
import { CommentSection } from "@/components/comment-section";
import { buildCodexCommentThreadKey } from "@/lib/comment-threads";
import { getCodexServiceMessages } from "@/lib/codex-service";
import type { ServiceLocale } from "@/lib/i18n";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import type { CodexPet, PetAction, PetLookOption, PetLookPart } from "@/lib/codex-types";
import { closeOnPlainClick } from "@/lib/plain-click";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { CompendiumAssetImageActions } from "./compendium-asset-image-actions";
import { DescriptionText } from "./codex-description";
import { GameHoverTip, HoverTip } from "./hover-tip";
import { PortaledHoverTipLayer } from "./portaled-hover-tip-layer";
import { MonsterSpineStage } from "./monster-spine-stage";
import Image from "@/components/ui/static-image";
import { RichDescription } from "./rich-description";
import { RelatedResourceLinks, referenceGroupsFromIds } from "./entity-reference-links";

/** The skins the game shows when nobody owns the pet: the first option of each look part. */
function defaultPetSkins(pet: CodexPet): string[] {
  return pet.looks.flatMap((part) => part.options[0]?.skin ?? []);
}

/** The pet's Spine animation (idle, or `action` once per `actionNonce`), or its render when it has no Spine asset. */
export function PetSpine({
  pet,
  className,
  skins,
  action = null,
  actionNonce,
  fixedFrame = false,
}: {
  pet: CodexPet;
  className: string;
  skins?: string[];
  action?: PetAction | null;
  actionNonce?: number;
  /** Hold the action frame instead of framing the idle pose (where actions play). */
  fixedFrame?: boolean;
}) {
  return (
    <MonsterSpineStage
      asset={pet.spineAsset}
      fallbackImageUrl={pet.imageUrl}
      monsterName={pet.name}
      // The stage plays an animation named like the move id ("die" plays the death clip).
      selectedMoveId={action}
      selectedMoveNonce={actionNonce}
      selectedSkins={skins ?? defaultPetSkins(pet)}
      viewportOverride={fixedFrame ? pet.actionFrame : null}
      imagePriority={false}
      showLoadingLabel={false}
      className={className}
      fallbackImageClassName="absolute inset-0 h-full w-full object-contain"
    />
  );
}

/** A look the pet can wear, drawn as the part it changes (or the character's Yummy Cookie for an eye). */
function PetLookToken({
  option,
  selected,
  onSelect,
  title,
}: {
  option: PetLookOption;
  selected: boolean;
  onSelect: () => void;
  title: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={title}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      className={`relative flex h-12 w-12 items-center justify-center rounded-lg border p-1 transition-colors hover:bg-white/10 ${
        selected ? "border-[#f1c94f]/70 bg-[#f1c94f]/15" : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <Image src={option.tokenUrl} alt="" width={48} height={48} className="h-full w-full object-contain" />
      {hovered && (
        <PortaledHoverTipLayer pin="top-left">
          <HoverTip title={title} compact />
        </PortaledHoverTipLayer>
      )}
    </button>
  );
}

export function PetInspect({
  pet,
  entities,
  gameUi,
  skins,
  action,
  actionNonce,
}: {
  pet: CodexPet;
  entities?: EntityInfo[];
  gameUi?: CodexGameUiLabels;
  skins?: string[];
  action?: PetAction | null;
  actionNonce?: number;
}) {
  return (
    <div className="flex w-full max-w-[34rem] flex-col items-center gap-3 sm:flex-row sm:gap-5">
      <PetSpine pet={pet} skins={skins} action={action} actionNonce={actionNonce} fixedFrame className="relative h-56 w-56 shrink-0" />
      <GameHoverTip title={pet.name} className="min-w-0 w-full" style={{ minWidth: 0 }}>
        {entities ? (
          <RichDescription
            gameUi={gameUi}
            description={pet.description}
            entities={entities}
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
  entities,
  onClose,
}: {
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
  backToListTitle: string;
  pet: CodexPet;
  entities?: EntityInfo[];
  onClose?: () => void;
}) {
  const localizeLink = useLocalizedHref();
  const serviceText = getCodexServiceMessages(serviceLocale);
  const view = serviceText.petsView;
  const assetCopyTargetRef = useRef<HTMLDivElement>(null);
  const [commentCount, setCommentCount] = useState(0);
  const englishName = serviceLocale === "ko" ? "영어명" : "English name";
  // Keyed by pet so the modal resets when it switches to another pet.
  const [lookState, setLookState] = useState<{ petId: string; skins: string[] }>({ petId: pet.id, skins: defaultPetSkins(pet) });
  const skins = lookState.petId === pet.id ? lookState.skins : defaultPetSkins(pet);
  const [actionState, setActionState] = useState<{ petId: string; action: PetAction; nonce: number } | null>(null);
  const action = actionState?.petId === pet.id ? actionState : null;
  const pickerLabelClass = "font-game-title text-sm font-bold text-[#f1c94f] [text-shadow:2px_2px_0_rgba(0,0,0,0.82)]";
  const fill = (template: string, values: Record<string, string | number>) =>
    template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match));
  const lookTitle = (part: PetLookPart, option: PetLookOption, index: number) =>
    part === "eye" && option.character
      ? option.character
      : part === "hair"
        ? fill(view.hairTitle, { n: index + 1 })
        : (view.lookOptions as Record<string, string>)[option.skin] ?? option.skin;

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
            <PetInspect
              pet={pet}
              entities={entities}
              gameUi={gameUi}
              skins={skins}
              action={action?.action ?? null}
              actionNonce={action?.nonce}
            />
          </div>
          <CompendiumAssetImageActions
            serviceLocale={serviceLocale}
            fileName={`${pet.id}.png`}
            targetRef={assetCopyTargetRef}
          />
          {pet.spineAsset && pet.looks.length > 0 && (
            <div className="mt-2 flex w-full max-w-2xl flex-col items-center gap-2">
              {pet.looks.map((part, partIndex) => (
                <div key={part.id} className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5">
                  <span className={pickerLabelClass}>{view.lookParts[part.id]}</span>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label={`${pet.name} ${view.lookParts[part.id]}`}>
                    {part.options.map((option, optionIndex) => (
                      <PetLookToken
                        key={option.skin}
                        option={option}
                        selected={skins[partIndex] === option.skin}
                        onSelect={() => {
                          setLookState({ petId: pet.id, skins: skins.map((skin, index) => (index === partIndex ? option.skin : skin)) });
                          // A held move would replay on the new look, so picking a look clears it.
                          setActionState(null);
                        }}
                        title={lookTitle(part.id, option, optionIndex)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-3">
          {pet.nameEn !== pet.name && (
            <section className="rounded-lg border border-border bg-compendium-rail px-4 py-3">
              <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">{englishName}</div>
              <div className="font-game-text text-sm text-foreground">{pet.nameEn}</div>
            </section>
          )}

          {pet.spineAsset && pet.actions.length > 0 && (
            <details className="group rounded-lg border border-border bg-compendium-rail px-4 py-3" open>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-game-title text-sm font-bold text-foreground">
                <span>{serviceText.monstersView.actionPreview}</span>
                <span className="text-xs text-gray-500 transition-transform group-open:rotate-180">⌄</span>
              </summary>
              <div className="mt-3 space-y-1.5">
                {pet.actions.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() =>
                      setActionState((current) =>
                        current?.petId === pet.id && current.action === name ? null : { petId: pet.id, action: name, nonce: (current?.nonce ?? 0) + 1 },
                      )
                    }
                    className={`w-full rounded-md border px-2.5 py-2 text-left transition-colors hover:bg-white/[0.06] ${
                      action?.action === name ? "border-[#efc851]/65 bg-white/[0.055]" : "border-white/[0.06] bg-white/[0.015]"
                    }`}
                  >
                    <span className="font-game-title block text-sm font-semibold text-gray-100">{view.actions[name]}</span>
                  </button>
                ))}
              </div>
            </details>
          )}

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
