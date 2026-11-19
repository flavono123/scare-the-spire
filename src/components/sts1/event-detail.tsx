"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import Image from "@/components/ui/static-image";
import { CompendiumAssetImageActions } from "@/components/codex/compendium-asset-image-actions";
import { MonsterAscensionStepper, useMonsterAscensionLevel } from "@/components/codex/monster-ascension";
import { Sts1CommentsRail } from "./comments-rail";
import { Sts1DetailShell, Sts1EnglishName, Sts1MetaPill } from "./detail-chrome";
import { Sts1EventText, fillSts1Template } from "./event-text";
import { Sts1EntityToken, Sts1ItemRefTokens } from "./ref-token";
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

function OptionTokens({ option, refs }: { option: Sts1EventOption; refs: Sts1EntityRefs }) {
  const items: ReactNode[] = [];
  const seen = new Set<string>();
  const push = (key: string, node: ReactNode) => {
    if (seen.has(key)) return;
    seen.add(key);
    items.push(node);
  };
  if (option.preview) push(`p-${option.preview.type}-${option.preview.id}`, <Sts1ItemRefTokens key="preview" item={option.preview} refs={refs} />);
  option.gains?.forEach((item, index) => push(`g-${item.type}-${item.id ?? JSON.stringify(item.pool) ?? index}`, (
    <Sts1ItemRefTokens key={`gain-${index}`} item={item} refs={refs} />
  )));
  option.loses?.forEach((item, index) => push(`l-${item.type}-${item.id ?? index}`, (
    <Sts1ItemRefTokens key={`lose-${index}`} item={item} refs={refs} tone="lose" />
  )));
  option.combat?.encounters.forEach((group, groupIndex) => {
    const counts = new Map<string, number>();
    for (const id of group) counts.set(id, (counts.get(id) ?? 0) + 1);
    push(`c-${groupIndex}`, (
      <span key={`combat-${groupIndex}`} className="inline-flex flex-wrap items-center gap-1">
        {[...counts].map(([id, count]) => <Sts1EntityToken key={id} type="monster" id={id} refs={refs} count={count} />)}
      </span>
    ));
  });
  if (items.length === 0) return null;
  return <span className="mt-1 flex flex-wrap items-center gap-1">{items}</span>;
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
    <div ref={captureRef} className="relative w-full overflow-hidden rounded-lg">
      <Image src={sts1EventUiUrl("panel")} alt="" fill className="pointer-events-none object-fill" sizes="900px" />
      <div className="relative grid gap-4 p-4 pt-12 sm:p-8 sm:pt-12 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:items-start">
        {showAscension ? (
          <div className="absolute left-3 top-3 z-10">
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
        <div className="relative mx-auto aspect-square w-full max-w-[22rem]">
          {image ? (
            <Image
              src={sts1EventImageUrl(image)}
              alt={event.name}
              fill
              className={`object-cover ${image.endsWith(".png") ? "object-contain p-[6%]" : "p-[3.5%]"}`}
              sizes="352px"
            />
          ) : null}
          <Image src={sts1EventUiUrl("imgFrame")} alt="" fill className="pointer-events-none object-fill" sizes="352px" />
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <h2 className="font-game-title text-2xl text-[#efc851] [text-shadow:0_2px_0_#000]">{event.name}</h2>
          {variants.length > 1 ? (
            <div className="flex flex-wrap items-center gap-1" role="tablist">
              {variants.map((variant, index) => (
                <button
                  key={index}
                  type="button"
                  role="tab"
                  aria-selected={index === variantIndex}
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
                  onClick={() => {
                    setBranch({ ...branch, index });
                    setEnded(false);
                    go(outcome.next);
                  }}
                  className={`rounded border px-2 py-0.5 ${index === branch.index ? "border-[#efc851]/70 text-[#efc851]" : "border-white/15 hover:text-gray-200"}`}
                >
                  {outcomeLabel(outcome, index)}
                </button>
              ))}
              {branch.outcomes[branch.index]?.gains?.length ? (
                <span className="flex flex-wrap gap-1">
                  {branch.outcomes[branch.index].gains!.map((item, index) => (
                    <Sts1ItemRefTokens key={index} item={item} refs={refs} />
                  ))}
                </span>
              ) : null}
            </div>
          ) : null}
          <Sts1EventText
            text={fill(body)}
            refs={refs}
            className="block font-game-text text-[15px] leading-relaxed text-[#fff6e2] [text-shadow:0_1px_0_#000]"
          />
          <div className="flex flex-col gap-1.5">
            {scene.options.filter((option) => optionShown(option, ascension)).map((option, index) => {
              const disabled = option.disabled || ended;
              return (
                <button
                  key={`${sceneKey}-${index}`}
                  type="button"
                  disabled={disabled}
                  onClick={() => choose(option)}
                  className="group relative w-full text-left transition-transform enabled:hover:translate-x-1 disabled:cursor-not-allowed"
                  data-sts1-event-option={index}
                >
                  <Image
                    src={sts1EventUiUrl(disabled ? "disabledButton" : "enabledButton")}
                    alt=""
                    fill
                    className="pointer-events-none object-fill group-enabled:group-hover:brightness-125"
                    sizes="560px"
                  />
                  <span className={`relative block px-5 py-2.5 ${disabled ? "opacity-60" : ""}`}>
                    <Sts1EventText
                      text={fill(option.label)}
                      refs={refs}
                      className="block font-game-text text-sm leading-snug text-[#fff6e2] [text-shadow:0_1px_0_#000]"
                    />
                    <OptionTokens option={option} refs={refs} />
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
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
  labels,
  eventLabels,
  serviceLocale,
  onClose,
}: {
  event: Sts1Event;
  refs: Sts1EntityRefs;
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
        <Sts1CommentsRail resourceType="event" slug={event.slug} serviceLocale={serviceLocale} />
      </Sts1DetailShell>
    </div>
  );
}
