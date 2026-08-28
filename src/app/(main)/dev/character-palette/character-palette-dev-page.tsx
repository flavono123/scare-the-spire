"use client";

import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { CharacterSpineStage } from "@/components/codex/character-spine-stage";
import { GameCheckboxToggle } from "@/components/codex/game-checkbox";
import { DuotoneCharacterToken } from "@/components/dev/duotone-character-token";
import Image from "@/components/ui/static-image";
import type { CodexCharacter } from "@/lib/codex-types";
import {
  CHARACTER_PALETTE_PAIRS,
  CHARACTER_PALETTE_SOURCE,
  normalizeHex,
  resolveDuotoneColors,
  swapHexPair,
  type CharacterPalettePair,
} from "@/lib/dev-character-palettes";
import { cn } from "@/lib/utils";

type ActionId = "IDLE" | "ATTACK" | "HURT";

export default function CharacterPaletteDevPage({
  characters,
}: {
  characters: CodexCharacter[];
}) {
  const firstPair = CHARACTER_PALETTE_PAIRS[0];
  const [colorAInput, setColorAInput] = useState(firstPair.colorA);
  const [colorBInput, setColorBInput] = useState(firstPair.colorB);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(firstPair.id);
  const [tokenCrossed, setTokenCrossed] = useState(false);
  const [spineCrossed, setSpineCrossed] = useState(false);
  const [characterId, setCharacterId] = useState(characters[0]?.id ?? "NECROBINDER");
  const [action, setAction] = useState<{ id: ActionId; nonce: number }>({
    id: "IDLE",
    nonce: 0,
  });

  const colorA = normalizeHex(colorAInput);
  const colorB = normalizeHex(colorBInput);
  const colorsReady = Boolean(colorA && colorB);
  const character = characters.find((entry) => entry.id === characterId) ?? characters[0];
  const tokenMap = colorA && colorB
    ? resolveDuotoneColors(colorA, colorB, tokenCrossed)
    : null;
  const spineMap = colorA && colorB
    ? resolveDuotoneColors(colorA, colorB, spineCrossed)
    : null;

  const playAction = (id: ActionId) => {
    setAction((current) => ({ id, nonce: current.nonce + 1 }));
  };

  const applyPreset = (pair: CharacterPalettePair) => {
    setColorAInput(pair.colorA);
    setColorBInput(pair.colorB);
    setSelectedPresetId(pair.id);
  };

  const swapColors = () => {
    const next = swapHexPair(colorAInput, colorBInput);
    setColorAInput(next.colorA);
    setColorBInput(next.colorB);
  };

  const crossSurfaces = () => {
    const alreadyCrossed = tokenCrossed !== spineCrossed;
    setSpineCrossed(alreadyCrossed ? tokenCrossed : !tokenCrossed);
  };

  return (
    <main
      data-dev-character-palette
      className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6"
    >
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300/80">
          DEV / CHARACTER PALETTE
        </p>
        <h1 className="text-3xl font-bold text-zinc-100">캐릭터 2색 배색</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-zinc-400">
          토큰과 Spine 모두 원본 명암으로 두 색을 다시 칠한다. 프리셋은{" "}
          <a
            href={CHARACTER_PALETTE_SOURCE.url}
            target="_blank"
            rel="noreferrer"
            className="text-amber-200/90 underline-offset-4 hover:underline"
          >
            {CHARACTER_PALETTE_SOURCE.title}
          </a>
          의 화면 HEX다. 교차하면 토큰과 Spine이 서로 뒤집힌다.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4 rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <HexPairFields
            colorA={colorAInput}
            colorB={colorBInput}
            onColorAChange={(value) => {
              setColorAInput(value);
              setSelectedPresetId(null);
            }}
            onColorBChange={(value) => {
              setColorBInput(value);
              setSelectedPresetId(null);
            }}
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={swapColors}
              className="inline-flex items-center gap-1.5 rounded border border-white/15 bg-white/[0.04] px-3 py-1.5 text-sm font-semibold text-zinc-100 hover:bg-white/[0.08]"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              색 스왑
            </button>
            <button
              type="button"
              onClick={crossSurfaces}
              className="rounded border border-white/15 bg-white/[0.04] px-3 py-1.5 text-sm font-semibold text-zinc-100 hover:bg-white/[0.08]"
            >
              토큰·스파인 교차
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <GameCheckboxToggle
              checked={tokenCrossed}
              onCheckedChange={setTokenCrossed}
              label="토큰 교차"
            />
            <GameCheckboxToggle
              checked={spineCrossed}
              onCheckedChange={setSpineCrossed}
              label="스파인 교차"
            />
          </div>

          {colorsReady && tokenMap && spineMap ? (
            <PaletteMapLegend tokenMap={tokenMap} spineMap={spineMap} />
          ) : (
            <p className="text-xs text-red-300/80">HEX 두 개를 모두 입력하세요.</p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-zinc-200">영상 16조합</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CHARACTER_PALETTE_PAIRS.map((pair) => {
              const active = pair.id === selectedPresetId;
              return (
                <button
                  key={pair.id}
                  type="button"
                  data-palette-id={pair.id}
                  aria-pressed={active}
                  onClick={() => applyPreset(pair)}
                  className={cn(
                    "flex flex-col overflow-hidden rounded-md border text-left transition-colors",
                    active
                      ? "border-amber-300/70 bg-amber-300/10"
                      : "border-white/10 bg-white/[0.03] hover:border-white/25",
                  )}
                >
                  <span className="flex h-8">
                    <span className="flex-1" style={{ backgroundColor: pair.colorA }} />
                    <span className="flex-1" style={{ backgroundColor: pair.colorB }} />
                  </span>
                  <span className="px-2 py-1.5 text-[11px] leading-tight text-zinc-200">
                    {pair.nameKoA} · {pair.nameKoB}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-100">얼굴 토큰</h2>
          <p className="text-xs text-zinc-500">원본 / 배색. 클릭하면 Spine 캐릭터가 바뀐다.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {characters.map((entry) => (
            <TokenPreviewCard
              key={entry.id}
              character={entry}
              selected={entry.id === character?.id}
              tokenMap={tokenMap}
              onSelect={() => {
                setCharacterId(entry.id);
                playAction("ATTACK");
              }}
            />
          ))}
        </div>
      </section>

      {character ? (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-100">Spine · {character.name}</h2>
            <div className="flex gap-1">
              {(["IDLE", "ATTACK", "HURT"] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => playAction(id)}
                  className={cn(
                    "rounded px-2 py-1 text-[11px] font-semibold",
                    action.id === id
                      ? "text-amber-200"
                      : "text-zinc-500 hover:text-zinc-200",
                  )}
                >
                  {id === "IDLE" ? "대기" : id === "ATTACK" ? "공격" : "피격"}
                </button>
              ))}
            </div>
          </div>
          <SpinePreview
            character={character}
            atlasDuotone={spineMap}
            selectedMoveId={action.id}
            selectedMoveNonce={action.nonce}
          />
        </section>
      ) : null}
    </main>
  );
}

function HexPairFields({
  colorA,
  colorB,
  onColorAChange,
  onColorBChange,
}: {
  colorA: string;
  colorB: string;
  onColorAChange: (value: string) => void;
  onColorBChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <HexField label="색 1 · 그림자" value={colorA} onChange={onColorAChange} />
      <HexField label="색 2 · 하이라이트" value={colorB} onChange={onColorBChange} />
    </div>
  );
}

function HexField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const normalized = normalizeHex(value);
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-zinc-400">{label}</span>
      <span className="flex items-center gap-2 rounded border border-white/10 bg-black/20 px-2 py-1.5">
        <input
          type="color"
          aria-label={label}
          value={normalized ?? "#000000"}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
        />
        <input
          type="text"
          spellCheck={false}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent font-mono text-sm text-zinc-100 outline-none"
        />
      </span>
    </label>
  );
}

function PaletteMapLegend({
  tokenMap,
  spineMap,
}: {
  tokenMap: { shadow: string; highlight: string };
  spineMap: { shadow: string; highlight: string };
}) {
  return (
    <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-400">
      <MapSwatch label="토큰" shadow={tokenMap.shadow} highlight={tokenMap.highlight} />
      <MapSwatch label="스파인" shadow={spineMap.shadow} highlight={spineMap.highlight} />
    </div>
  );
}

function MapSwatch({
  label,
  shadow,
  highlight,
}: {
  label: string;
  shadow: string;
  highlight: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span>{label}</span>
      <span
        className="h-3 overflow-hidden rounded"
        style={{ backgroundImage: `linear-gradient(90deg, ${shadow}, ${highlight})` }}
      />
      <span className="font-mono text-[10px] text-zinc-500">
        {shadow} → {highlight}
      </span>
    </div>
  );
}

function TokenPreviewCard({
  character,
  selected,
  tokenMap,
  onSelect,
}: {
  character: CodexCharacter;
  selected: boolean;
  tokenMap: { shadow: string; highlight: string } | null;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      data-character-id={character.id}
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg border px-3 py-3 transition-colors",
        selected
          ? "border-amber-300/70 bg-amber-300/10"
          : "border-white/10 bg-white/[0.03] hover:border-white/25",
      )}
    >
      <span className="text-xs font-semibold text-zinc-200">{character.name}</span>
      <span className="flex items-center gap-3">
        <Image
          src={character.iconUrl}
          alt=""
          width={56}
          height={56}
          className="h-14 w-14 object-contain"
        />
        {tokenMap ? (
          <DuotoneCharacterToken
            iconUrl={character.iconUrl}
            shadowHex={tokenMap.shadow}
            highlightHex={tokenMap.highlight}
          />
        ) : (
          <Image
            src={character.iconUrl}
            alt=""
            width={56}
            height={56}
            className="h-14 w-14 object-contain opacity-70"
          />
        )}
      </span>
    </button>
  );
}

function SpinePreview({
  character,
  atlasDuotone,
  selectedMoveId,
  selectedMoveNonce,
}: {
  character: CodexCharacter;
  atlasDuotone: { shadow: string; highlight: string } | null;
  selectedMoveId: ActionId;
  selectedMoveNonce: number;
}) {
  return (
    <div
      data-spine-character-id={character.id}
      className="relative h-[22rem] overflow-hidden rounded-lg border border-white/10 bg-[#120f18] sm:h-[28rem]"
    >
      <CharacterSpineStage
        character={character}
        selectedMoveId={selectedMoveId}
        selectedMoveNonce={selectedMoveNonce}
        atlasDuotone={atlasDuotone}
        className="relative h-full w-full"
      />
    </div>
  );
}
