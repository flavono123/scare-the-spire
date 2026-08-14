"use client";

import { useMemo } from "react";
import Link from "next/link";
import Image from "@/components/ui/static-image";
import type { CodexCharacter, MonsterSpineAsset } from "@/lib/codex-types";
import { CHARACTER_COLORS, CHARACTER_ORDER } from "@/lib/codex-types";
import type { ServiceLocale } from "@/lib/i18n";
import { localizeHref } from "@/lib/i18n";
import { buildCompendiumResourceHref } from "@/lib/compendium-resource-links";
import {
  CharacterSpineStage,
  characterHasLowHealthIdle,
  characterLowHealthHp,
  withCharacterLowHealthIdle,
} from "./character-spine-stage";

const HEALTH_BAR_CLIP_PATH = "polygon(6px 0, calc(100% - 6px) 0, 100% 50%, calc(100% - 6px) 100%, 6px 100%, 0 50%)";
const CHARACTER_LOW_HP_VIEWPORT = {
  padLeft: "14%",
  padRight: "14%",
  padTop: "10%",
  padBottom: "0%",
} as const;

export function CharacterLowHpIdleBlock({
  characters,
  serviceLocale,
  defaultOpen = true,
}: {
  characters: readonly CodexCharacter[];
  serviceLocale: ServiceLocale;
  defaultOpen?: boolean;
}) {
  const ordered = CHARACTER_ORDER
    .map((id) => characters.find((character) => character.id === id))
    .filter((character): character is CodexCharacter => Boolean(character && characterHasLowHealthIdle(character)));
  if (ordered.length === 0) return null;

  const title = serviceLocale === "ko" ? "낮은 체력 대기" : "Low HP Idle";
  const summary = serviceLocale === "ko"
    ? "체력이 최대치의 25% 이하일 때 대기 모션이 바뀝니다."
    : "Idle changes when remaining HP is 25% or less.";

  return (
    <details className="group my-4" open={defaultOpen}>
      <summary className="inline-flex cursor-pointer list-none items-center gap-2 text-sm text-blue-400 transition-colors marker:hidden hover:text-blue-300">
        <span className="font-game-title font-bold">{title}</span>
        <span className="shrink-0 text-xs transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <div className="mt-2">
        <p className="mb-3 font-game-text text-xs leading-relaxed text-zinc-400">
          {summary}
        </p>
        <div className="relative left-1/2 w-[min(96vw,72rem)] -translate-x-1/2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {ordered.map((character) => (
              <CharacterLowHpIdleCell
                key={character.id}
                character={character}
                serviceLocale={serviceLocale}
              />
            ))}
          </div>
        </div>
      </div>
    </details>
  );
}

function CharacterLowHpIdleCell({
  character,
  serviceLocale,
}: {
  character: CodexCharacter;
  serviceLocale: ServiceLocale;
}) {
  const name = serviceLocale === "ko" ? character.name : character.nameEn;
  const href = localizeHref(buildCompendiumResourceHref("character", character.id), serviceLocale);
  const color = CHARACTER_COLORS[character.id.toLowerCase()] ?? "#eab308";
  const maxHp = character.startingHp;
  const currentHp = characterLowHealthHp(maxHp);
  const fillRatio = Math.max(0, Math.min(1, currentHp / Math.max(maxHp, 1)));
  const hpLabel = `${currentHp}/${maxHp}`;
  const staticAsset = useMemo(
    () => withCharacterLowHealthViewport(withCharacterLowHealthIdle(character.spineAsset, true)),
    [character.spineAsset],
  );
  const staticAssetJson = staticAsset ? JSON.stringify(staticAsset) : undefined;

  return (
    <div className="flex min-w-0 flex-col items-center gap-2">
      <div
        data-character-low-hp-idle={character.id}
        className="relative h-44 w-full sm:h-52"
      >
        {character.combatImageUrl ? (
          <Image
            src={character.combatImageUrl}
            alt={name}
            width={640}
            height={640}
            className="absolute inset-0 z-10 h-full w-full object-contain opacity-80 drop-shadow-[0_12px_24px_rgba(0,0,0,0.55)]"
            data-static-spine-fallback={staticAssetJson ? "true" : undefined}
          />
        ) : null}
        {staticAssetJson ? (
          <span
            className="sts2-static-spine-stage sts2-spine-stage pointer-events-none absolute inset-0 z-20 opacity-0 transition-opacity duration-300"
            data-static-spine-preview="true"
            data-static-spine-asset={staticAssetJson}
            data-static-spine-move-id="IDLE"
            data-static-spine-loop="true"
            data-static-spine-monster-name={character.name}
            aria-hidden="true"
          />
        ) : null}
        <CharacterSpineStage
          character={character}
          selectedMoveId="IDLE"
          lowHealthIdle
          fallbackImageClassName="absolute inset-0 z-10 h-full w-full object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.55)]"
          className="relative z-20 h-full w-full"
        />
        <div className="pointer-events-none absolute inset-x-2 bottom-1 z-40 flex flex-col items-center">
          <span
            className="relative inline-flex h-5 w-full max-w-36 items-center justify-center overflow-visible"
            aria-label={serviceLocale === "ko" ? `체력 ${hpLabel}` : `HP ${hpLabel}`}
          >
            <span
              aria-hidden="true"
              className="absolute left-0 right-0 top-1/2 h-[8px] -translate-y-1/2 bg-[#4d5a61] shadow-[0_2px_3px_rgba(0,0,0,0.72)]"
              style={{ clipPath: HEALTH_BAR_CLIP_PATH }}
            >
              <span className="absolute inset-[2px] bg-[#071a1a]" style={{ clipPath: HEALTH_BAR_CLIP_PATH }} />
              <span
                className="absolute inset-y-[2px] left-[2px] right-[2px] origin-left bg-gradient-to-b from-[#ff6258] via-[#F1373E] to-[#b11219]"
                style={{ clipPath: HEALTH_BAR_CLIP_PATH, transform: `scaleX(${fillRatio})` }}
              />
            </span>
            <span
              className="relative z-10 font-game-title text-[11px] font-black leading-none text-[#fff8db]"
              style={{ textShadow: "0 1px 0 #900000, 1px 1px 0 #900000, -1px 1px 0 #900000" }}
            >
              {hpLabel}
            </span>
          </span>
        </div>
      </div>
      <Link
        href={href}
        className="font-game-title text-sm font-bold hover:underline"
        style={{ color }}
      >
        {name}
      </Link>
    </div>
  );
}

function withCharacterLowHealthViewport(asset: MonsterSpineAsset | null): MonsterSpineAsset | null {
  if (!asset) return null;
  return {
    ...asset,
    viewport: {
      ...asset.viewport,
      ...CHARACTER_LOW_HP_VIEWPORT,
    },
  };
}
