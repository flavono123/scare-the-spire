"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { CHARACTER_STAGE_VIEWPORT_PADDING } from "@/components/codex/character-spine-stage";
import { EncounterSceneStage } from "@/components/codex/encounter-scene-stage";
import { GameCheckboxToggle } from "@/components/codex/game-checkbox";
import { MonsterSpineStage } from "@/components/codex/monster-spine-stage";
import { DuotoneCharacterToken } from "@/components/dev/duotone-character-token";
import Image from "@/components/ui/static-image";
import type { CodexEncounter, CodexMonster } from "@/lib/codex-types";
import {
  CHARACTER_PALETTE_PAIRS,
  CHARACTER_PALETTE_SOURCE,
  normalizeHex,
  resolveDuotoneColors,
  swapHexPair,
  type CharacterPalettePair,
} from "@/lib/dev-character-palettes";
import {
  PALETTE_KIND_COPY,
  PALETTE_KINDS,
  paletteActionLabel,
  subjectsForKind,
  type PaletteKind,
  type PaletteSubject,
} from "@/lib/dev-palette-subjects";
import { cn } from "@/lib/utils";

const MONSTER_LAB_VIEWPORT_PADDING = {
  padLeft: "8%",
  padRight: "8%",
  padTop: "24%",
  padBottom: "16%",
} as const;

export default function CharacterPaletteDevPage({
  subjects,
  encounters,
  monsters,
}: {
  subjects: PaletteSubject[];
  encounters: CodexEncounter[];
  monsters: CodexMonster[];
}) {
  const firstPair = CHARACTER_PALETTE_PAIRS[0];
  const [colorAInput, setColorAInput] = useState(firstPair.colorA);
  const [colorBInput, setColorBInput] = useState(firstPair.colorB);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(firstPair.id);
  const [tokenCrossed, setTokenCrossed] = useState(false);
  const [spineCrossed, setSpineCrossed] = useState(false);
  const [kind, setKind] = useState<PaletteKind>("character");
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "IRONCLAD");
  const [action, setAction] = useState<{ id: string; nonce: number }>({
    id: "IDLE",
    nonce: 0,
  });

  const colorA = normalizeHex(colorAInput);
  const colorB = normalizeHex(colorBInput);
  const colorsReady = Boolean(colorA && colorB);
  const kindSubjects = useMemo(() => subjectsForKind(subjects, kind), [kind, subjects]);
  const encounterById = useMemo(
    () => new Map(encounters.map((encounter) => [encounter.id, encounter])),
    [encounters],
  );
  const subject = kindSubjects.find((entry) => entry.id === subjectId) ?? kindSubjects[0];
  const tokenMap = colorA && colorB
    ? resolveDuotoneColors(colorA, colorB, tokenCrossed)
    : null;
  const spineMap = colorA && colorB
    ? resolveDuotoneColors(colorA, colorB, spineCrossed)
    : null;
  const selectedActionId = subject?.actionIds.includes(action.id)
    ? action.id
    : (subject?.actionIds[0] ?? "IDLE");
  const copy = PALETTE_KIND_COPY[kind];

  const playAction = (id: string) => {
    setAction((current) => ({ id, nonce: current.nonce + 1 }));
  };

  const selectKind = (nextKind: PaletteKind) => {
    const nextSubjects = subjectsForKind(subjects, nextKind);
    setKind(nextKind);
    setSubjectId(nextSubjects[0]?.id ?? "");
    setAction({ id: nextSubjects[0]?.actionIds[0] ?? "IDLE", nonce: 0 });
  };

  const selectSubject = (entry: PaletteSubject) => {
    setSubjectId(entry.id);
    playAction(entry.actionIds[0] ?? "IDLE");
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
      data-palette-kind={kind}
      className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6"
    >
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300/80">
          DEV / CHARACTER PALETTE
        </p>
        <h1 className="text-3xl font-bold text-zinc-100">2색 배색</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-zinc-400">
          토큰이 있으면 원본 명암·알파로, 스파인이 있으면 아틀라스 픽셀로 두 색을 다시 칠한다. 보스는 전투
          토큰과 전투 배치 아틀라스를 쓴다. 프리셋은{" "}
          <a
            href={CHARACTER_PALETTE_SOURCE.url}
            target="_blank"
            rel="noreferrer"
            className="text-amber-200/90 underline-offset-4 hover:underline"
          >
            {CHARACTER_PALETTE_SOURCE.title}
          </a>
          의 화면 HEX다. 엘리트는 게임 토큰이 없고, 고대의 존재는 니오우·테즈카타라만 스파인이 있다.
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

      <nav className="flex flex-wrap gap-2" aria-label="배색 대상">
        {PALETTE_KINDS.map((entry) => (
          <button
            key={entry}
            type="button"
            data-palette-kind-tab={entry}
            aria-pressed={entry === kind}
            onClick={() => selectKind(entry)}
            className={cn(
              "rounded px-3 py-1.5 text-sm font-semibold",
              entry === kind
                ? "border border-amber-300/70 bg-amber-300/10 text-amber-100"
                : "border border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/25",
            )}
          >
            {PALETTE_KIND_COPY[entry].title}
          </button>
        ))}
      </nav>

      <section className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-100">{copy.tokenHeading}</h2>
          <p className="text-xs text-zinc-500">{copy.tokenHint}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {kindSubjects.map((entry) => (
            <SubjectPreviewCard
              key={`${entry.kind}:${entry.id}`}
              subject={entry}
              selected={entry.id === subject?.id}
              tokenMap={tokenMap}
              onSelect={() => selectSubject(entry)}
            />
          ))}
        </div>
      </section>

      {subject ? (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-100">Spine · {subject.name}</h2>
            {subject.spineAsset ? (
              <div className="flex flex-wrap gap-1">
                {subject.actionIds.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => playAction(id)}
                    className={cn(
                      "rounded px-2 py-1 text-[11px] font-semibold",
                      selectedActionId === id
                        ? "text-amber-200"
                        : "text-zinc-500 hover:text-zinc-200",
                    )}
                  >
                    {paletteActionLabel(id)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <SpinePreview
            subject={subject}
            encounter={subject.encounterId ? encounterById.get(subject.encounterId) ?? null : null}
            monsters={monsters}
            atlasDuotone={spineMap}
            selectedMoveId={selectedActionId}
            selectedMoveNonce={action.nonce}
            emptyLabel={copy.emptySpine}
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

function SubjectPreviewCard({
  subject,
  selected,
  tokenMap,
  onSelect,
}: {
  subject: PaletteSubject;
  selected: boolean;
  tokenMap: { shadow: string; highlight: string } | null;
  onSelect: () => void;
}) {
  const originalUrl = subject.tokenUrl ?? subject.pickerImageUrl;
  return (
    <button
      type="button"
      data-palette-subject-id={subject.id}
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg border px-3 py-3 transition-colors",
        selected
          ? "border-amber-300/70 bg-amber-300/10"
          : "border-white/10 bg-white/[0.03] hover:border-white/25",
      )}
    >
      <span className="text-center text-xs font-semibold text-zinc-200">{subject.name}</span>
      <span className="flex items-center gap-3">
        {originalUrl ? (
          <Image
            src={originalUrl}
            alt=""
            width={56}
            height={56}
            className="h-14 w-14 object-contain"
          />
        ) : (
          <span className="flex h-14 w-14 items-center justify-center text-[10px] text-zinc-500">
            없음
          </span>
        )}
        {subject.kind !== "elite" ? (
          subject.tokenUrl && tokenMap ? (
            <DuotoneCharacterToken
              iconUrl={subject.tokenUrl}
              shadowHex={tokenMap.shadow}
              highlightHex={tokenMap.highlight}
            />
          ) : subject.tokenUrl ? (
            <Image
              src={subject.tokenUrl}
              alt=""
              width={56}
              height={56}
              className="h-14 w-14 object-contain opacity-70"
            />
          ) : (
            <span className="flex h-14 w-14 items-center justify-center text-[10px] leading-tight text-zinc-500">
              토큰 없음
            </span>
          )
        ) : null}
      </span>
    </button>
  );
}

function SpinePreview({
  subject,
  encounter,
  monsters,
  atlasDuotone,
  selectedMoveId,
  selectedMoveNonce,
  emptyLabel,
}: {
  subject: PaletteSubject;
  encounter: CodexEncounter | null;
  monsters: CodexMonster[];
  atlasDuotone: { shadow: string; highlight: string } | null;
  selectedMoveId: string;
  selectedMoveNonce: number;
  emptyLabel: string;
}) {
  if (subject.spinePreview === "encounter" && encounter?.scene) {
    return (
      <div
        data-spine-subject-id={subject.id}
        data-spine-preview="encounter"
        className="overflow-hidden rounded-lg border border-white/10 bg-[#120f18]"
      >
        <EncounterSceneStage
          encounter={encounter}
          character={null}
          monsters={monsters}
          serviceLocale="ko"
          interactive={false}
          atlasDuotone={atlasDuotone}
          selectedMoveId={selectedMoveId}
          selectedMoveNonce={selectedMoveNonce}
        />
      </div>
    );
  }

  if (subject.spinePreview === "static" && subject.staticPreviewUrl) {
    return (
      <div
        data-spine-subject-id={subject.id}
        data-spine-preview="static"
        className="relative aspect-video overflow-hidden rounded-lg border border-white/10 bg-[#120f18]"
      >
        {encounter?.scene ? (
          <Image
            src={encounter.scene.backgroundUrl}
            alt=""
            fill
            className="object-cover"
          />
        ) : null}
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          {atlasDuotone ? (
            <DuotoneCharacterToken
              iconUrl={subject.staticPreviewUrl}
              shadowHex={atlasDuotone.shadow}
              highlightHex={atlasDuotone.highlight}
              size={288}
              className="h-72 w-72"
            />
          ) : (
            <Image
              src={subject.staticPreviewUrl}
              alt={subject.name}
              width={288}
              height={288}
              className="h-72 w-72 object-contain"
            />
          )}
        </div>
      </div>
    );
  }

  if (!subject.spineAsset) {
    return (
      <div
        data-spine-subject-id={subject.id}
        data-spine-preview="empty"
        className="flex h-[12rem] items-center justify-center rounded-lg border border-white/10 bg-[#120f18] text-sm text-zinc-500 sm:h-[16rem]"
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div
      data-spine-subject-id={subject.id}
      data-spine-preview="monster"
      className="relative h-[22rem] overflow-hidden rounded-lg border border-white/10 bg-[#120f18] sm:h-[28rem]"
    >
      <MonsterSpineStage
        asset={subject.spineAsset}
        fallbackImageUrl={subject.fallbackImageUrl}
        monsterName={subject.name}
        selectedMoveId={selectedMoveId}
        selectedMoveNonce={selectedMoveNonce}
        showLoadingLabel={false}
        viewportTransitionTime={0}
        viewportPadding={
          subject.kind === "character"
            ? CHARACTER_STAGE_VIEWPORT_PADDING
            : MONSTER_LAB_VIEWPORT_PADDING
        }
        atlasDuotone={atlasDuotone}
        className="relative h-full w-full"
      />
    </div>
  );
}
