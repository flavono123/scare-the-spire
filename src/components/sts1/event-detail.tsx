"use client";

import { useMemo, useRef, useState } from "react";
import Image from "@/components/ui/static-image";
import { CompendiumAssetImageActions } from "@/components/codex/compendium-asset-image-actions";
import { MonsterAscensionStepper, useMonsterAscensionLevel } from "@/components/codex/monster-ascension";
import { Sts1CommentsRail } from "./comments-rail";
import { Sts1RelatedRail } from "./related-rail";
import type { Sts1RelatedGroup } from "@/lib/sts1/relations";
import { Sts1DetailShell, Sts1EnglishName, Sts1MetaPill } from "./detail-chrome";
import { Sts1EventText, fillSts1Template } from "./event-text";
import { Sts1HoverPreviews, sts1ItemPreviewIds, sts1PreviewEntityIds } from "./ref-token";
import type { ServiceLocale } from "@/lib/i18n";
import { STS1_MONSTER_ASCENSION_SCOPE } from "@/lib/sts1/monster-moves";
import { sts1EventImageUrl, sts1EventUiUrl, sts1IndexPath, sts1UiImageUrl } from "@/lib/sts1/paths";
import type {
  Sts1EntityRefs,
  Sts1Event,
  Sts1EventLabels,
  Sts1EventOption,
  Sts1EventOutcome,
  Sts1UiLabels,
} from "@/lib/sts1/types";

function detailText(serviceLocale: ServiceLocale) {
  return serviceLocale === "ko"
    ? { restart: "처음으로", results: "가능한 결과", body: "본문" }
    : { restart: "Restart", results: "Possible results", body: "Text" };
}

function optionShown(option: Sts1EventOption, ascension: number): boolean {
  const range = option.ascension;
  if (!range) return true;
  return (range.min == null || ascension >= range.min) && (range.max == null || ascension <= range.max);
}

/** Whether any number, option or text in the event changes with ascension. */
function usesAscension(event: Sts1Event): boolean {
  if (Object.values(event.vars).some((tiers) => tiers.some((tier) => tier.ascension > 0))) return true;
  return Object.values(event.scenes).some((scene) => scene.options.some((option) => option.ascension));
}

/** What hovering an option previews: what it takes, gives, shows or names, then whom it fights. */
function optionPreviewIds(option: Sts1EventOption, refs: Sts1EntityRefs): string[] {
  const items = [...(option.loses ?? []), ...(option.gains ?? []), ...(option.preview ? [option.preview] : []), ...(option.mentions ?? [])];
  const monsters = option.combat?.encounters.flat() ?? [];
  return [...new Set([...sts1ItemPreviewIds(items, refs), ...sts1PreviewEntityIds([{ type: "monster", ids: monsters }], refs)])];
}

// Small sprites the room draws on the floor; the rest are full pictures or room backgrounds.
const SPRITE_ART = new Set(["nopants.png", "sphereClosed.png", "sphereOpen.png"]);

/** The event's picture in GenericEventDialog's frame, or the room's monsters when it has none. */
export function Sts1EventArt({
  image,
  monsters,
  refs,
  alt = "",
  sizes,
  className = "relative aspect-square w-full",
}: {
  image: string | null;
  monsters: readonly string[];
  refs: Sts1EntityRefs;
  alt?: string;
  sizes: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="absolute inset-[3.5%] overflow-hidden bg-[#0d1316]">
        {image ? (
          <Image
            src={sts1EventImageUrl(image)}
            alt={alt}
            fill
            className={SPRITE_ART.has(image) ? "object-contain p-[10%] object-bottom" : "object-cover"}
            sizes={sizes}
          />
        ) : (
          <div className="absolute inset-0 flex items-end justify-center gap-[2%] px-[6%] pb-[12%]">
            {monsters.map((id, index) => {
              const monster = refs.monster[id];
              return monster ? (
                <Image
                  key={`${id}-${index}`}
                  src={monster.imageUrl}
                  alt=""
                  width={160}
                  height={160}
                  className="h-auto max-h-[70%] min-w-0 flex-1 object-contain object-bottom"
                />
              ) : null;
            })}
          </div>
        )}
      </div>
      <Image src={sts1EventUiUrl("imgFrame")} alt="" fill className="pointer-events-none object-fill" sizes={sizes} />
    </div>
  );
}

/** The event screen: GenericEventDialog's panel, art in its frame, body and LargeDialogOptionButtons. */
export function Sts1EventScreen({
  event,
  refs,
  labels,
  serviceLocale,
  captureRef,
}: {
  event: Sts1Event;
  refs: Sts1EntityRefs;
  labels: Sts1UiLabels;
  serviceLocale: ServiceLocale;
  captureRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const text = detailText(serviceLocale);
  const [ascension, setAscension] = useMonsterAscensionLevel(STS1_MONSTER_ASCENSION_SCOPE);
  const [sceneKey, setSceneKey] = useState(event.start);
  const [variantIndex, setVariantIndex] = useState(0);
  const [branch, setBranch] = useState<{ outcomes: Sts1EventOutcome[]; index: number } | null>(null);
  const [ended, setEnded] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const scene = event.scenes[sceneKey] ?? event.scenes[event.start];
  const image = scene.image !== undefined ? scene.image : event.image;
  const variants = scene.bodyVariants ?? [];
  const body = variants[variantIndex]?.body ?? scene.body;
  const showAscension = useMemo(() => usesAscension(event), [event]);
  const fill = (template: Sts1EventOption["label"]) => fillSts1Template(template, event.vars, ascension);

  const go = (key: string) => {
    setSceneKey(key);
    setVariantIndex(0);
  };
  const restart = () => {
    go(event.start);
    setBranch(null);
    setEnded(false);
  };
  const choose = (option: Sts1EventOption) => {
    if (option.outcomes?.length) {
      setBranch({ outcomes: option.outcomes, index: 0 });
      go(option.outcomes[0].next);
      return;
    }
    setBranch(null);
    if (option.next) go(option.next);
    else setEnded(true);
  };
  const outcomeLabel = (outcome: Sts1EventOutcome, index: number) => {
    if (outcome.character) return labels.characters[outcome.character];
    if (outcome.chance != null) return `${outcome.chance}%`;
    return String(index + 1);
  };

  return (
    <div ref={captureRef} className="relative w-full rounded-lg md:aspect-[1763/806]" style={{ containerType: "inline-size" }}>
      {/* GenericEventDialog.render: the 1763×806 panel, title centered on its banner (x 570, y +408),
          the 600px picture centered at x 460, text from x 816, 900 wide (1920×1080 screen). */}
      {/* The panel art only holds its shape at its own aspect; narrow screens get its black field. */}
      <div className="pointer-events-none absolute inset-0 rounded-lg bg-black/80 md:hidden" />
      <Image src={sts1EventUiUrl("panel")} alt="" fill className="pointer-events-none hidden object-fill opacity-80 md:block" sizes="900px" />
      <h2 className="relative mx-[4%] pt-[3%] text-center font-game-title text-xl text-[#ffd563] [text-shadow:0_0_2px_#000,0_2px_0_#000] md:absolute md:left-[2%] md:top-0 md:m-0 md:w-[50.4%] md:pt-[2.2%] md:text-[clamp(1rem,2.3cqw,1.6rem)]">
        {event.name}
      </h2>
      <div className="relative grid gap-4 p-4 pt-4 md:grid-cols-[34%_51%] md:gap-x-[6.8%] md:p-0 md:pl-[3.9%] md:pt-[8.6%] md:pb-[3%] md:items-start">
        {showAscension ? (
          <div className="absolute right-3 top-3 z-10 md:left-[62%] md:right-auto md:top-[1.6%]">
            <MonsterAscensionStepper
              level={ascension}
              onChange={setAscension}
              serviceLocale={serviceLocale}
              maxLevel={STS1_MONSTER_ASCENSION_SCOPE.maxLevel}
              iconSrc={sts1UiImageUrl("ascension")}
              prominent
            />
          </div>
        ) : null}
        <Sts1EventArt
          image={image}
          monsters={event.artMonsters}
          refs={refs}
          alt={event.name}
          sizes="352px"
          className="relative mx-auto aspect-square w-full max-w-[22rem] md:max-w-none"
        />
        <div className="flex min-w-0 flex-col gap-3 md:pt-[1%]">
          {variants.length > 1 ? (
            <div className="flex flex-wrap items-center gap-1" role="tablist">
              {variants.map((variant, index) => (
                <button
                  key={index}
                  type="button"
                  role="tab"
                  aria-selected={index === variantIndex}
                  data-sts1-variant={index}
                  onClick={() => setVariantIndex(index)}
                  className={`rounded border px-2 py-0.5 font-game-text text-xs ${index === variantIndex ? "border-[#efc851]/70 text-[#efc851]" : "border-white/15 text-gray-400 hover:text-gray-200"}`}
                >
                  {variant.characters
                    ? variant.characters.map((id) => labels.characters[id]).join(" · ")
                    : variant.monster
                      ? refs.monster[variant.monster]?.name ?? variant.monster
                      : index + 1}
                </button>
              ))}
            </div>
          ) : null}
          {branch && branch.outcomes.length > 1 ? (
            <div className="flex flex-wrap items-center gap-1 font-game-text text-xs text-gray-400">
              <span>{text.results}</span>
              {branch.outcomes.map((outcome, index) => (
                <button
                  key={`${outcome.next}-${index}`}
                  type="button"
                  aria-pressed={index === branch.index}
                  data-sts1-outcome={index}
                  onMouseEnter={() => setHovered(`outcome-${index}`)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => {
                    setBranch({ ...branch, index });
                    setEnded(false);
                    go(outcome.next);
                  }}
                  className={`relative rounded border px-2 py-0.5 ${index === branch.index ? "border-[#efc851]/70 text-[#efc851]" : "border-white/15 hover:text-gray-200"}`}
                >
                  {outcomeLabel(outcome, index)}
                  {hovered === `outcome-${index}` ? <Sts1HoverPreviews entityIds={sts1ItemPreviewIds(outcome.gains ?? [], refs)} /> : null}
                </button>
              ))}
            </div>
          ) : null}
          <Sts1EventText
            text={fill(body)}
            refs={refs}
            className="block font-game-text text-[15px] leading-relaxed text-[#fff6e2] [text-shadow:0_1px_0_#000]"
            data-sts1-event-body=""
          />
          <div className="flex flex-col gap-1.5">
            {scene.options.filter((option) => optionShown(option, ascension)).map((option, index) => {
              const disabled = option.disabled || ended;
              return (
                <div
                  key={`${sceneKey}-${index}`}
                  onMouseEnter={() => setHovered(`option-${index}`)}
                  onMouseLeave={() => setHovered(null)}
                  className={`group relative transition-transform ${disabled ? "" : "hover:translate-x-1 focus-within:translate-x-1"}`}
                  data-sts1-event-option={index}
                >
                  {/* LargeDialogOptionButton: the box is tinted 0.4 gray until hovered (white), text 0.8 gray
                      until hovered (white), and FIREBRICK on the disabled box. */}
                  <Image
                    src={sts1EventUiUrl(disabled ? "disabledButton" : "enabledButton")}
                    alt=""
                    fill
                    className={`pointer-events-none object-fill brightness-[0.4] transition-[filter] ${disabled ? "" : "group-hover:brightness-100 group-focus-within:brightness-100"}`}
                    sizes="560px"
                  />
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => choose(option)}
                    className="relative block w-full px-5 py-2.5 text-left outline-none disabled:cursor-not-allowed"
                  >
                    <Sts1EventText
                      text={fill(option.label)}
                      className={`block font-game-text text-sm leading-snug [text-shadow:0_1px_0_#000] ${disabled ? "text-[#b22222]" : "text-[#cccccc] group-hover:text-white"}`}
                    />
                  </button>
                  {hovered === `option-${index}` ? <Sts1HoverPreviews entityIds={optionPreviewIds(option, refs)} /> : null}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            data-sts1-restart=""
            onClick={restart}
            className={`self-start rounded-md border px-3 py-1 font-game-text text-xs transition-colors ${ended ? "border-[#efc851]/70 text-[#efc851]" : "border-white/15 text-gray-300 hover:text-white"}`}
          >
            ↺ {text.restart}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Sts1EventDetail({
  event,
  refs,
  related = [],
  labels,
  eventLabels,
  serviceLocale,
  onClose,
}: {
  event: Sts1Event;
  refs: Sts1EntityRefs;
  related?: readonly Sts1RelatedGroup[];
  labels: Sts1UiLabels;
  eventLabels: Sts1EventLabels;
  serviceLocale: ServiceLocale;
  onClose?: () => void;
}) {
  const captureRef = useRef<HTMLDivElement>(null);
  return (
    <div className="mx-auto w-full max-w-6xl">
      <Sts1DetailShell
        backHref={sts1IndexPath("events")}
        backLabel={eventLabels.title}
        onClose={onClose}
        serviceLocale={serviceLocale}
        heroLayout="icon"
        assetActions={(
          <CompendiumAssetImageActions serviceLocale={serviceLocale} fileName={`${event.slug}.png`} targetRef={captureRef} />
        )}
        hero={<Sts1EventScreen event={event} refs={refs} labels={labels} serviceLocale={serviceLocale} captureRef={captureRef} />}
      >
        <section className="rounded-lg border border-border bg-compendium-rail px-4 py-3">
          <h1 className="font-game-title text-2xl text-primary">{event.name}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            {event.dungeons.filter((dungeon) => dungeon !== "ending").map((dungeon) => (
              <Sts1MetaPill key={dungeon} value={`${eventLabels.dungeons[dungeon].act} ${eventLabels.dungeons[dungeon].name}`} />
            ))}
            {event.groups.filter((group) => group === "shrine" || group === "special").map((group) => (
              <Sts1MetaPill key={group} value={eventLabels.groups[group]} color="#efc851" />
            ))}
          </div>
          <div className="mt-3">
            <Sts1EnglishName name={event.name} nameEn={event.nameEn} serviceLocale={serviceLocale} />
          </div>
        </section>
        <Sts1RelatedRail groups={related} serviceLocale={serviceLocale} />
        <Sts1CommentsRail resourceType="event" slug={event.slug} serviceLocale={serviceLocale} />
      </Sts1DetailShell>
    </div>
  );
}
