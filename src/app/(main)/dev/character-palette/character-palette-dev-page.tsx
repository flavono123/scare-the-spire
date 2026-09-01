"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { GameCheckboxToggle } from "@/components/codex/game-checkbox";
import { PaletteNicknameSurfaceGallery } from "@/components/dev/palette-nickname-surfaces";
import { DuotoneCharacterToken } from "@/components/dev/duotone-character-token";
import Image from "@/components/ui/static-image";
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
  paletteNicknameIconUrl,
  subjectsForKind,
  type PaletteKind,
  type PaletteSubject,
} from "@/lib/dev-palette-subjects";
import { cn } from "@/lib/utils";

const LAB_NICKNAME = "네바";

export default function CharacterPaletteDevPage({
  subjects,
}: {
  subjects: PaletteSubject[];
}) {
  const firstPair = CHARACTER_PALETTE_PAIRS[0];
  const [colorAInput, setColorAInput] = useState(firstPair.colorA);
  const [colorBInput, setColorBInput] = useState(firstPair.colorB);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(firstPair.id);
  const [tokenCrossed, setTokenCrossed] = useState(false);
  const [kind, setKind] = useState<PaletteKind>("character");
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "IRONCLAD");

  const colorA = normalizeHex(colorAInput);
  const colorB = normalizeHex(colorBInput);
  const colorsReady = Boolean(colorA && colorB);
  const kindSubjects = useMemo(() => subjectsForKind(subjects, kind), [kind, subjects]);
  const subject = kindSubjects.find((entry) => entry.id === subjectId) ?? kindSubjects[0];
  const tokenMap = colorA && colorB
    ? resolveDuotoneColors(colorA, colorB, tokenCrossed)
    : null;
  const nicknameIconUrl = subject ? paletteNicknameIconUrl(subject) : null;
  const copy = PALETTE_KIND_COPY[kind];

  const selectKind = (nextKind: PaletteKind) => {
    const nextSubjects = subjectsForKind(subjects, nextKind);
    setKind(nextKind);
    setSubjectId(nextSubjects[0]?.id ?? "");
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

  return (
    <main
      data-dev-character-palette
      data-palette-kind={kind}
      data-selected-subject-id={subject?.id ?? ""}
      className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6"
    >
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300/80">
          DEV / CHARACTER PALETTE
        </p>
        <h1 className="text-3xl font-bold text-zinc-100">2색 배색</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-zinc-400">
          토큰이 있으면 원본 명암·알파로 두 색을 다시 칠한다. 같은 토큰을 댓글·장난감 상자 닉네임 앞에
          아이콘으로 붙인다. 프리셋은{" "}
          <a
            href={CHARACTER_PALETTE_SOURCE.url}
            target="_blank"
            rel="noreferrer"
            className="text-amber-200/90 underline-offset-4 hover:underline"
          >
            {CHARACTER_PALETTE_SOURCE.title}
          </a>
          의 화면 HEX다. 엘리트는 게임 토큰이 없다.
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
          </div>

          <GameCheckboxToggle
            checked={tokenCrossed}
            onCheckedChange={setTokenCrossed}
            label="토큰 교차"
          />

          {colorsReady && tokenMap ? (
            <MapSwatch label="토큰" shadow={tokenMap.shadow} highlight={tokenMap.highlight} />
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
              onSelect={() => setSubjectId(entry.id)}
            />
          ))}
        </div>
      </section>

      {subject ? (
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-zinc-100">닉네임 자리</h2>
            <p className="text-xs text-zinc-500">
              {subject.name} 토큰과 현재 배색. 미디어 쿼리 분기는 그리지 않는다.
            </p>
          </div>
          <PaletteNicknameSurfaceGallery
            tone={{
              nickname: LAB_NICKNAME,
              iconUrl: nicknameIconUrl,
              duotone: tokenMap,
            }}
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
    <div className="flex flex-col gap-1 text-[11px] text-zinc-400">
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
