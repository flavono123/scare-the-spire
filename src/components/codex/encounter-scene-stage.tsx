"use client";

import { useMemo, useState, type CSSProperties } from "react";
import Image from "@/components/ui/static-image";
import Link from "next/link";
import { buildCompendiumResourceHref } from "@/lib/compendium-resource-links";
import {
  expandEncounterFormations,
  formatEncounterProbability,
} from "@/lib/encounter-compositions";
import { localizeHref, type ServiceLocale } from "@/lib/i18n";
import type {
  CodexEncounter,
  CodexMonster,
  EncounterSceneCombatLayout,
  EncounterSceneCombatMonsterLayout,
  EncounterSceneMonsterSlot,
} from "@/lib/codex-types";
import { serviceMessages } from "@/messages/service";
import { FakeMerchantEncounterSpineLayer } from "./fake-merchant-spine-stage";
import { MonsterSpineStage } from "./monster-spine-stage";
import { BoundedCarouselFrame } from "./bounded-carousel";

interface EncounterSceneStageProps {
  encounter: CodexEncounter;
  monsters: CodexMonster[];
  serviceLocale: ServiceLocale;
}

interface PositionedMonster {
  monster: CodexMonster;
  style: CSSProperties;
}

const FIREFLIES = [
  [17, 18, 0.2], [25, 34, 1.1], [34, 15, 2.2], [43, 27, 0.7],
  [51, 39, 1.8], [58, 17, 2.8], [67, 31, 0.4], [75, 22, 1.4],
  [83, 37, 2.5], [89, 16, 0.9], [39, 52, 2.1], [71, 48, 1.2],
] as const;

const QUEEN_LIGHTS = [
  { x: 73.6, y: 23.5, rotate: 36.2, scaleX: 0.6, scaleY: 0.7 },
  { x: 80.5, y: 25.6, rotate: 36.2, scaleX: 0.8, scaleY: 1 },
  { x: 89.2, y: 26.8, rotate: 36.2, scaleX: 1, scaleY: 1 },
  { x: 26.4, y: 24.7, rotate: 143.8, scaleX: 0.6, scaleY: -0.7 },
  { x: 19.8, y: 25.2, rotate: 143.8, scaleX: 0.8, scaleY: -1 },
  { x: 10.8, y: 26.5, rotate: 143.8, scaleX: 1, scaleY: -1 },
] as const;

export function EncounterSceneStage({
  encounter,
  monsters,
  serviceLocale,
}: EncounterSceneStageProps) {
  const formations = useMemo(() => expandEncounterFormations(encounter), [encounter]);
  const monsterById = useMemo(
    () => new Map(monsters.map((monster) => [monster.id, monster])),
    [monsters],
  );
  const [formationSelection, setFormationSelection] = useState({
    encounterId: encounter.id,
    index: 0,
  });
  const [formationMenuState, setFormationMenuState] = useState({
    encounterId: encounter.id,
    open: false,
  });
  const scene = encounter.scene;
  const labels = serviceMessages[serviceLocale].codex.encountersView;

  if (!scene || formations.length === 0) return null;
  const formationIndex = formationSelection.encounterId === encounter.id
    ? Math.min(formationSelection.index, formations.length - 1)
    : 0;
  const formationMenuOpen = formationMenuState.encounterId === encounter.id
    ? formationMenuState.open
    : false;
  const formation = formations[formationIndex];
  const positionedMonsters = positionFormationMonsters(
    formation.monsters.flatMap((ref) => {
      const monster = monsterById.get(ref.id);
      return monster ? [{ monster, slotName: ref.slotName }] : [];
    }),
    scene.monsterSlots,
    scene.combatLayout,
  );
  const locale = serviceLocale === "ko" ? "ko-KR" : "en-US";
  const chance = formatEncounterProbability(formation.probability, locale);
  const formationLabel = getFormationLabel(formation);
  const chanceLabel = labels.appearanceChance.replace("{chance}", chance);
  const usesFakeMerchantBackground = encounter.id === "FAKE_MERCHANT_EVENT_ENCOUNTER";

  const moveFormation = (offset: number) => {
    setFormationSelection({
      encounterId: encounter.id,
      index: Math.max(0, Math.min(formationIndex + offset, formations.length - 1)),
    });
    setFormationMenuState({ encounterId: encounter.id, open: false });
  };

  const selectFormation = (index: number) => {
    setFormationSelection({ encounterId: encounter.id, index });
    setFormationMenuState({ encounterId: encounter.id, open: false });
  };

  return (
    <div className="w-full" data-encounter-scene>
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl">
        {!usesFakeMerchantBackground && (
          <Image
            src={scene.backgroundUrl}
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 704px, 100vw"
            className="object-cover"
          />
        )}

        <EncounterAmbientVfx encounter={encounter} />

        {usesFakeMerchantBackground && (
          <FakeMerchantEncounterSpineLayer
            layer="bottom"
            fallbackImageUrl="/images/sts2/events/fake_merchant.webp"
            className="z-10"
          />
        )}

        {scene.backgroundSpineAsset && (
          <div className="pointer-events-none absolute inset-0 z-10" data-encounter-background-spine>
            <MonsterSpineStage
              asset={scene.backgroundSpineAsset}
              fallbackImageUrl={null}
              monsterName={`${encounter.name} background`}
              selectedMoveId={null}
              className="absolute inset-0"
              imagePriority={false}
              showLoadingLabel={false}
              viewportTransitionTime={0}
            />
          </div>
        )}

        {positionedMonsters.map(({ monster, style }, index) => (
          <Link
            key={`${formation.id}:${index}:${monster.id}`}
            href={localizeHref(
              buildCompendiumResourceHref("monster", monster.id),
              serviceLocale,
            )}
            aria-label={monster.name}
            className="group absolute z-20 block after:absolute after:-inset-2 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            style={style}
          >
            <MonsterSpineStage
              asset={monster.spineAsset}
              fallbackImageUrl={usesFakeMerchantBackground
                ? null
                : monster.imageUrl ?? monster.bossImageUrl}
              monsterName={monster.name}
              selectedMoveId={null}
              className="absolute inset-0 transition-transform duration-200 group-hover:scale-[1.03]"
              fallbackImageClassName="absolute inset-0 z-10 h-full w-full object-contain drop-shadow-[0_14px_18px_rgba(0,0,0,0.75)]"
              imagePriority={index < 2}
              showLoadingLabel={false}
              viewportTransitionTime={0}
              viewportPadding={{ padLeft: "0%", padRight: "0%", padTop: "0%", padBottom: "0%" }}
            />
            <span className="absolute bottom-0 left-1/2 z-40 -translate-x-1/2 translate-y-1/2 whitespace-nowrap rounded-full border border-white/15 bg-black/75 px-2 py-0.5 font-game-title text-[9px] font-bold text-gray-100 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 sm:text-[11px]">
              {monster.name}
            </span>
          </Link>
        ))}

        {usesFakeMerchantBackground && (
          <FakeMerchantEncounterSpineLayer
            layer="cutter"
            className="z-30"
          />
        )}

        <div
          className="absolute bottom-2 left-1/2 z-40 w-[min(42rem,calc(100%-1rem))] -translate-x-1/2 sm:bottom-3"
          data-encounter-formation-controls
        >
          <div className="relative rounded-lg border border-white/10 bg-black/75 p-1.5 shadow-lg backdrop-blur-sm">
            {formationMenuOpen && (
              <div
                id={`encounter-formation-menu-${encounter.id}`}
                role="listbox"
                aria-label={labels.selectFormation}
                className="absolute inset-x-0 bottom-full mb-2 max-h-40 overflow-y-auto overscroll-contain rounded-lg border border-amber-300/25 bg-[#090b13]/95 p-1.5 shadow-2xl [scrollbar-color:rgba(251,191,36,0.45)_transparent] sm:max-h-56"
                data-encounter-formation-menu
              >
                <div className="sticky top-0 z-10 mb-1 flex items-center justify-between rounded bg-[#090b13]/95 px-2 py-1 font-game-title text-[10px] font-bold text-amber-200 sm:text-xs">
                  <span>{labels.selectFormation}</span>
                  <span className="text-gray-500">{formationIndex + 1} / {formations.length}</span>
                </div>
                {formations.map((candidate, index) => {
                  const candidateChance = labels.appearanceChance.replace(
                    "{chance}",
                    formatEncounterProbability(candidate.probability, locale),
                  );
                  const selected = index === formationIndex;
                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => selectFormation(index)}
                      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left font-game-text transition-colors ${
                        selected
                          ? "bg-amber-300/15 text-amber-100"
                          : "text-gray-300 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <span className="w-7 shrink-0 text-right text-[9px] text-gray-500 sm:text-[10px]">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[10px] font-bold sm:text-xs">
                        {getFormationLabel(candidate)}
                      </span>
                      <span className="shrink-0 text-[8px] text-amber-200/75 sm:text-[9px]">
                        {candidateChance}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <BoundedCarouselFrame
              canMovePrevious={formationIndex > 0}
              canMoveNext={formationIndex < formations.length - 1}
              onPrevious={() => moveFormation(-1)}
              onNext={() => moveFormation(1)}
              previousLabel={labels.previousFormation}
              nextLabel={labels.nextFormation}
            >
              <div className="grid min-w-0 grid-cols-[minmax(0,0.24fr)_minmax(0,1fr)_minmax(0,0.24fr)] items-stretch gap-1 overflow-hidden">
                {formationIndex > 0 ? (
                  <FormationNeighborButton
                    label={getFormationLabel(formations[formationIndex - 1])}
                    side="previous"
                    onClick={() => selectFormation(formationIndex - 1)}
                  />
                ) : <span />}

                {formations.length > 1 ? (
                  <button
                    type="button"
                    aria-expanded={formationMenuOpen}
                    aria-controls={`encounter-formation-menu-${encounter.id}`}
                    aria-label={formationMenuOpen ? labels.closeFormationMenu : labels.openFormationMenu}
                    onClick={() => setFormationMenuState({
                      encounterId: encounter.id,
                      open: !formationMenuOpen,
                    })}
                    className="min-w-0 rounded-md px-1.5 py-0.5 text-center font-game-text leading-tight transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                  >
                    <span className="block truncate text-[10px] font-bold text-gray-100 sm:text-xs">
                      {formationLabel}
                    </span>
                    <span className="block text-[8px] text-amber-200/90 sm:text-[10px]">
                      {chanceLabel} · {formationIndex + 1}/{formations.length}
                    </span>
                  </button>
                ) : (
                  <div className="min-w-0 px-1.5 py-0.5 text-center font-game-text leading-tight">
                    <div className="truncate text-[10px] font-bold text-gray-100 sm:text-xs">
                      {formationLabel}
                    </div>
                    <div className="text-[8px] text-amber-200/90 sm:text-[10px]">{chanceLabel}</div>
                  </div>
                )}

                {formationIndex < formations.length - 1 ? (
                  <FormationNeighborButton
                    label={getFormationLabel(formations[formationIndex + 1])}
                    side="next"
                    onClick={() => selectFormation(formationIndex + 1)}
                  />
                ) : <span />}
              </div>
            </BoundedCarouselFrame>
          </div>
        </div>
      </div>
    </div>
  );
}

function getFormationLabel(formation: ReturnType<typeof expandEncounterFormations>[number]): string {
  return formation.monsters.map((monster) => monster.name).join(" + ");
}

function FormationNeighborButton({
  label,
  side,
  onClick,
}: {
  label: string;
  side: "previous" | "next";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-0 overflow-hidden rounded py-1 font-game-text text-[8px] text-gray-500 opacity-70 transition-colors hover:bg-white/10 hover:text-gray-200 hover:opacity-100 sm:text-[9px] ${
        side === "previous" ? "text-right" : "text-left"
      }`}
      aria-hidden
      tabIndex={-1}
    >
      <span className="block truncate">{label}</span>
    </button>
  );
}

function EncounterAmbientVfx({ encounter }: { encounter: CodexEncounter }) {
  const ambientVfx = encounter.scene?.ambientVfx;
  if (!ambientVfx || ambientVfx.kind === "none") return null;

  if (ambientVfx.kind === "fireflies") {
    return (
      <div className="pointer-events-none absolute inset-0 z-[5]" aria-hidden>
        {FIREFLIES.map(([x, y, delay], index) => (
          <span
            key={index}
            className="absolute h-1 w-1 rounded-full bg-lime-200 shadow-[0_0_7px_2px_rgba(190,242,100,0.8)] motion-safe:animate-pulse sm:h-1.5 sm:w-1.5"
            style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${delay}s` }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden" aria-hidden>
      {QUEEN_LIGHTS.map((light, index) => (
        <Image
          key={index}
          src={ambientVfx.lightTextureUrl}
          alt=""
          width={1251}
          height={1820}
          className="absolute h-auto w-[43.4%] max-w-none opacity-20 mix-blend-screen motion-safe:animate-pulse"
          style={{
            left: `${light.x}%`,
            top: `${light.y}%`,
            animationDelay: `${index * 0.45}s`,
            animationDuration: "4s",
            transform: `translate(-50%, -50%) rotate(${light.rotate}deg) scale(${light.scaleX}, ${light.scaleY})`,
          }}
        />
      ))}
    </div>
  );
}

function positionFormationMonsters(
  placements: Array<{ monster: CodexMonster; slotName: string | null }>,
  fixedSlots: EncounterSceneMonsterSlot[],
  combatLayout: EncounterSceneCombatLayout,
): PositionedMonster[] {
  const fixedSlotByName = new Map(fixedSlots.map((slot) => [slot.slotName, slot]));
  const combatLayoutById = new Map(
    combatLayout.monsters.map((monsterLayout) => [monsterLayout.monsterId, monsterLayout]),
  );
  const monsters = placements.map(({ monster }) => monster);
  const autoPositions = positionEnemiesFromGameBounds(monsters, combatLayoutById, combatLayout);
  const coordinateWidth = combatLayout.coordinateSize.width;
  const coordinateHeight = combatLayout.coordinateSize.height;

  return placements.map(({ monster, slotName }, index) => {
    const fixedSlot = slotName ? fixedSlotByName.get(slotName) : undefined;
    const monsterLayout = combatLayoutById.get(monster.id);
    const sourcePosition = fixedSlot?.sourcePosition
      ?? autoPositions[index]
      ?? { x: coordinateWidth * 0.75, y: combatLayout.enemyBaselineY };
    const position = applyGameCamera(sourcePosition, combatLayout);
    const width = (monsterLayout?.bounds.width ?? 200) * combatLayout.cameraScaling;
    const height = (monsterLayout?.bounds.height ?? 220) * combatLayout.cameraScaling;

    return {
      monster,
      style: {
        left: `${(position.x / coordinateWidth) * 100}%`,
        top: `${(position.y / coordinateHeight) * 100}%`,
        width: `${(width / coordinateWidth) * 100}%`,
        height: `${(height / coordinateHeight) * 100}%`,
        transform: "translate(-50%, -100%)",
      },
    };
  });
}

function positionEnemiesFromGameBounds(
  monsters: CodexMonster[],
  layoutById: Map<string, EncounterSceneCombatMonsterLayout>,
  combatLayout: EncounterSceneCombatLayout,
): Array<{ x: number; y: number }> {
  if (combatLayout.usesFixedSlots) return [];
  const widths = monsters.map((monster) => layoutById.get(monster.id)?.bounds.width ?? 200);
  const availableWidth = combatLayout.enemyRegionWidth / combatLayout.cameraScaling;
  const creatureWidth = widths.reduce((sum, width) => sum + width, 0);
  let gap = combatLayout.enemyGap;
  let totalWidth = creatureWidth + Math.max(0, monsters.length - 1) * gap;
  let start = Math.max((availableWidth - totalWidth) * 0.5, combatLayout.enemyMinStart);
  let stagger = 0;

  if (start + totalWidth > availableWidth && monsters.length > 1) {
    gap = Math.max(
      (availableWidth - combatLayout.enemyMinStart - creatureWidth) / (monsters.length - 1),
      5,
    );
    totalWidth = creatureWidth + (monsters.length - 1) * gap;
    start = (availableWidth - totalWidth) * 0.5;
    if (gap < 30) stagger = 60 + (40 - 60) * ((gap - 5) / 25);
  }

  const positions: Array<{ x: number; y: number }> = [];
  let cursor = start;
  for (let index = 0; index < monsters.length; index += 1) {
    positions.push({
      x: combatLayout.coordinateSize.width * 0.5 + cursor + widths[index] * 0.5,
      y: combatLayout.enemyBaselineY - (index % 2 === 1 ? stagger : 0),
    });
    cursor += widths[index] + gap;
  }
  return positions;
}

function applyGameCamera(
  position: { x: number; y: number },
  combatLayout: EncounterSceneCombatLayout,
): { x: number; y: number } {
  const centerX = combatLayout.coordinateSize.width * 0.5;
  const centerY = combatLayout.coordinateSize.height * 0.5;
  return {
    x: centerX + (position.x - centerX) * combatLayout.cameraScaling + combatLayout.cameraOffset.x,
    y: centerY + (position.y - centerY) * combatLayout.cameraScaling + combatLayout.cameraOffset.y,
  };
}
