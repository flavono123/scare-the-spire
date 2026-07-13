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
  EncounterSceneMonsterSlot,
} from "@/lib/codex-types";
import { serviceMessages } from "@/messages/service";
import { MonsterSpineStage } from "./monster-spine-stage";

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
  const scene = encounter.scene;
  const labels = serviceMessages[serviceLocale].codex.encountersView;

  if (!scene || formations.length === 0) return null;
  const formationIndex = formationSelection.encounterId === encounter.id
    ? formationSelection.index % formations.length
    : 0;
  const formation = formations[formationIndex % formations.length];
  const positionedMonsters = positionFormationMonsters(
    formation.monsters.flatMap((ref) => {
      const monster = monsterById.get(ref.id);
      return monster ? [monster] : [];
    }),
    scene.monsterSlots,
  );
  const locale = serviceLocale === "ko" ? "ko-KR" : "en-US";
  const chance = formatEncounterProbability(formation.probability, locale);
  const formationLabel = labels.formationIndicator
    .replace("{current}", String(formationIndex + 1))
    .replace("{total}", String(formations.length));
  const chanceLabel = labels.appearanceChance.replace("{chance}", chance);

  const moveFormation = (offset: number) => {
    setFormationSelection({
      encounterId: encounter.id,
      index: (formationIndex + offset + formations.length) % formations.length,
    });
  };

  return (
    <div className="w-full" data-encounter-scene>
      <div className="relative aspect-[32/15] w-full overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl">
        <Image
          src={scene.backgroundUrl}
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 704px, 100vw"
          className="object-cover"
        />

        <EncounterAmbientVfx encounter={encounter} />

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
            className="group absolute z-20 block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            style={style}
          >
            <MonsterSpineStage
              asset={monster.spineAsset}
              fallbackImageUrl={monster.imageUrl ?? monster.bossImageUrl}
              monsterName={monster.name}
              selectedMoveId={null}
              className="absolute inset-0 transition-transform duration-200 group-hover:scale-[1.03]"
              fallbackImageClassName="absolute inset-0 z-10 h-full w-full object-contain drop-shadow-[0_14px_18px_rgba(0,0,0,0.75)]"
              imagePriority={index < 2}
              showLoadingLabel={false}
              viewportTransitionTime={0}
            />
            <span className="absolute bottom-0 left-1/2 z-40 -translate-x-1/2 translate-y-1/2 whitespace-nowrap rounded-full border border-white/15 bg-black/75 px-2 py-0.5 font-game-title text-[9px] font-bold text-gray-100 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 sm:text-[11px]">
              {monster.name}
            </span>
          </Link>
        ))}

        <div
          className="absolute bottom-2 left-2 z-40 flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-lg border border-white/10 bg-black/70 p-1.5 shadow-lg backdrop-blur-sm sm:bottom-3 sm:left-3"
          data-encounter-formation-controls
        >
          {formations.length > 1 && (
            <button
              type="button"
              onClick={() => moveFormation(-1)}
              aria-label={labels.previousFormation}
              className="flex h-7 w-7 items-center justify-center rounded text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              ‹
            </button>
          )}
          <div className="min-w-0 px-1 text-center font-game-text leading-tight">
            <div className="truncate text-[10px] font-bold text-gray-100 sm:text-xs">
              {formations.length > 1 ? formationLabel : formation.monsters.map((monster) => monster.name).join(" + ")}
            </div>
            <div className="text-[9px] text-amber-200/90 sm:text-[10px]">{chanceLabel}</div>
          </div>
          {formations.length > 1 && (
            <button
              type="button"
              onClick={() => moveFormation(1)}
              aria-label={labels.nextFormation}
              className="flex h-7 w-7 items-center justify-center rounded text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              ›
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EncounterAmbientVfx({ encounter }: { encounter: CodexEncounter }) {
  const ambientVfx = encounter.scene?.ambientVfx;
  if (!ambientVfx) return null;

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
  monsters: CodexMonster[],
  fixedSlots: EncounterSceneMonsterSlot[],
): PositionedMonster[] {
  const fixedSlotById = new Map(fixedSlots.map((slot) => [slot.monsterId, slot]));
  const autoPositions = getAutoMonsterPositions(monsters.length);

  return monsters.map((monster, index) => {
    const fixedSlot = fixedSlotById.get(monster.id);
    const position = fixedSlot
      ? { x: fixedSlot.x * 100, y: fixedSlot.y * 100 }
      : autoPositions[index] ?? autoPositions.at(-1) ?? { x: 75, y: 73 };
    const isQueen = monster.id === "QUEEN";
    const isTorchHead = monster.id === "TORCH_HEAD_AMALGAM";
    const width = isQueen ? 31 : isTorchHead ? 27 : monsters.length >= 3 ? 23 : 29;
    const height = isQueen ? 62 : isTorchHead ? 57 : monsters.length >= 3 ? 57 : 63;

    return {
      monster,
      style: {
        left: `${position.x}%`,
        top: `${position.y}%`,
        width: `${width}%`,
        height: `${height}%`,
        transform: "translate(-50%, -100%)",
      },
    };
  });
}

function getAutoMonsterPositions(count: number): Array<{ x: number; y: number }> {
  if (count <= 1) return [{ x: 76, y: 73 }];
  if (count === 2) return [{ x: 64, y: 73 }, { x: 84, y: 73 }];
  return [{ x: 57, y: 73 }, { x: 73, y: 73 }, { x: 88, y: 73 }];
}
