"use client";

import { type ReactNode, useMemo, useState } from "react";
import Image from "@/components/ui/static-image";
import Link from "next/link";
import { CommentSection } from "@/components/comment-section";
import { buildCodexCommentThreadKey } from "@/lib/comment-threads";
import type { ServiceLocale } from "@/lib/i18n";
import { localizeHref } from "@/lib/i18n";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import type { STS2Change, STS2Patch } from "@/lib/types";
import { getBestiaryDisplayMonsterType } from "@/lib/bestiary-monster-policy";
import { serviceMessages } from "@/messages/service";
import {
  CodexEncounter,
  CodexMonster,
  ENCOUNTER_ROOM_TYPE_CONFIG,
  MONSTER_TYPE_CONFIG,
} from "@/lib/codex-types";
import { DescriptionText } from "./codex-description";
import { EntityReferenceLinks, type CodexReferenceTarget } from "./entity-reference-links";
import { STS2ChangeHistory } from "./sts2-change-history";

const BESTIARY_ACT_COLOR = "#60a5fa";

function MetaPill({ value, color }: { value: string; color?: string }) {
  return (
    <span
      className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 font-game-text text-sm font-bold"
      style={color ? { color } : undefined}
    >
      {value}
    </span>
  );
}

function InfoRailSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      className="group rounded-lg border border-white/10 bg-black/20 px-4 py-3"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-game-title text-sm font-bold text-gray-200">
        <span>{title}</span>
        <span className="text-xs text-gray-500 transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

interface EncounterDetailProps {
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
  backToListTitle: string;
  encounter: CodexEncounter;
  monsters: CodexMonster[];
  patches?: STS2Patch[];
  changes?: STS2Change[];
  onClose?: () => void;
}

export function EncounterDetail({
  serviceLocale,
  gameUi,
  backToListTitle,
  encounter,
  monsters,
  patches,
  changes,
  onClose,
}: EncounterDetailProps) {
  const serviceText = serviceMessages[serviceLocale];
  const commonText = serviceText.codex.common;
  const encounterText = serviceText.codex.encountersView;
  const detailLabels = serviceLocale === "ko"
    ? {
        englishName: "영어명",
        patchHistory: "패치 이력",
        noPatchHistory: "구조화 변경 없음",
      }
    : {
        englishName: "English name",
        patchHistory: "Patch History",
        noPatchHistory: "No structured changes",
      };
  const roomConfig = ENCOUNTER_ROOM_TYPE_CONFIG[encounter.roomType];
  const monsterById = useMemo(
    () => new Map(monsters.map((monster) => [monster.id, monster])),
    [monsters],
  );
  const uniqueMonsters = useMemo(
    () => Array.from(new Map(encounter.monsters.map((monster) => [monster.id, monster])).values()),
    [encounter.monsters],
  );
  const [commentCount, setCommentCount] = useState(0);
  const relatedMonsterTargets: CodexReferenceTarget[] = uniqueMonsters.map((monsterRef) => {
    const monster = monsterById.get(monsterRef.id);
    const href = `/compendium/bestiary?monster=${monsterRef.id.toLowerCase()}`;
    return {
      id: monsterRef.id,
      href,
      title: monsterRef.name,
      entity: {
        id: monsterRef.id,
        nameEn: monster?.nameEn ?? monsterRef.nameEn,
        nameKo: monster?.name ?? monsterRef.name,
        imageUrl: monster?.bossImageUrl ?? monster?.imageUrl ?? null,
        href,
        color: monster?.type ?? "monster",
        type: "monster" as const,
        monsterData: monster,
      },
    };
  });

  return (
    <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
      <div className="mb-4 flex w-full items-center justify-between gap-3">
        <Link
          href={localizeHref("/compendium/bestiary?view=encounters", serviceLocale)}
          className="text-sm text-gray-400 transition-colors hover:text-gray-200"
          onClick={(event) => {
            if (onClose) {
              event.preventDefault();
              onClose();
            }
          }}
        >
          ← {backToListTitle}
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-white/10"
            aria-label={commonText.close}
          >
            ✕
          </button>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] lg:items-start">
        <section className="flex min-h-[28rem] flex-col items-center justify-center gap-5 py-4">
          <div className="flex w-full flex-wrap items-end justify-center gap-x-6 gap-y-4">
            {uniqueMonsters.map((monsterRef) => {
              const monster = monsterById.get(monsterRef.id);
              const imageUrl = monster?.imageUrl ?? monster?.bossImageUrl ?? null;
              const displayType = monster
                ? getBestiaryDisplayMonsterType(monster.id, monster.type)
                : null;
              const color = displayType ? MONSTER_TYPE_CONFIG[displayType].color : roomConfig.color;

              return (
                <Link
                  key={monsterRef.id}
                  href={localizeHref(`/compendium/bestiary?monster=${monsterRef.id.toLowerCase()}`, serviceLocale)}
                  className="group flex min-w-[7rem] flex-col items-center gap-2 text-center"
                >
                  <div className="relative flex h-32 w-36 items-center justify-center sm:h-40 sm:w-44">
                    <div
                      className="absolute bottom-2 left-[18%] right-[18%] h-5 rounded-[50%] blur-md"
                      style={{ backgroundColor: `${color}33` }}
                    />
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={monsterRef.name}
                        width={176}
                        height={160}
                        className="relative z-10 max-h-full max-w-full object-contain drop-shadow-[0_18px_24px_rgba(0,0,0,0.45)] transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div
                        className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full border text-2xl font-bold"
                        style={{ borderColor: `${color}66`, color }}
                      >
                        {monsterRef.name.slice(0, 1)}
                      </div>
                    )}
                  </div>
                  <span className="font-game-title text-sm font-bold" style={{ color }}>
                    {monsterRef.name}
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="text-center">
            <h1
              className="font-game-title break-keep text-3xl font-bold leading-tight text-gray-100 sm:text-4xl"
              style={{ color: roomConfig.color }}
            >
              {encounter.name}
            </h1>
          </div>
        </section>

        <aside className="flex flex-col gap-3">
          <section className="rounded-lg border border-white/10 bg-black/20 px-4 py-3">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <MetaPill
                  value={gameUi.encounterRoomTypes[encounter.roomType]}
                  color={roomConfig.color}
                />
                <MetaPill
                  value={getActLabel(encounter.act, gameUi, serviceText.codex)}
                  color={encounter.act ? BESTIARY_ACT_COLOR : "#a1a1aa"}
                />
                {encounter.isWeak && (
                  <MetaPill value={encounterText.weakEncounter} color="#4ade80" />
                )}
                {encounter.tags?.map((tag) => (
                  <MetaPill key={tag} value={tag} />
                ))}
              </div>
              {encounter.nameEn !== encounter.name && (
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">{detailLabels.englishName}</div>
                  <div className="font-game-text text-sm text-gray-300">{encounter.nameEn}</div>
                </div>
              )}
            </div>
          </section>

          <EntityReferenceLinks
            kind="monster"
            serviceLocale={serviceLocale}
            targets={relatedMonsterTargets}
          />

          {encounter.lossText && (
            <InfoRailSection title={encounterText.lossText}>
              <div className="font-game-text text-sm italic leading-relaxed text-gray-400">
                <DescriptionText description={encounter.lossText} />
              </div>
            </InfoRailSection>
          )}

          <InfoRailSection title={detailLabels.patchHistory}>
            <STS2ChangeHistory
              serviceLocale={serviceLocale}
              entityType="encounter"
              entityId={encounter.id}
              changes={changes}
              patches={patches}
              emptyLabel={detailLabels.noPatchHistory}
            />
          </InfoRailSection>

          <InfoRailSection title={`${commonText.comments}${commentCount > 0 ? ` (${commentCount})` : ""}`}>
            <CommentSection
              threadKey={buildCodexCommentThreadKey("encounter", encounter.id)}
              onCountChange={setCommentCount}
            />
          </InfoRailSection>
        </aside>
      </div>
    </div>
  );
}

function getActLabel(
  act: CodexEncounter["act"],
  gameUi: CodexGameUiLabels,
  serviceText: (typeof serviceMessages)[ServiceLocale]["codex"],
): string {
  return act ? gameUi.acts[act] : serviceText.labels.acts.none;
}
