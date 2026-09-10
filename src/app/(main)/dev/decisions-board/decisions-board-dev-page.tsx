"use client";

import { useMemo } from "react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { DecisionsDecisionsBoard } from "@/components/decisions-decisions/decisions-decisions-board";
import { useDecisionsDecisionsCatalog } from "@/hooks/use-decisions-decisions-catalog";
import { ContentLoadingNotice } from "@/components/content-loading-notice";
import {
  cloneDefaultRows,
  DECISIONS_DECISIONS_RESOURCE_TYPES,
  entityToResourceRef,
  findPresetDef,
  stampPresetIds,
  type DecisionsDecisionsResourceRef,
  type TierPlacement,
  type TierRow,
} from "@/lib/decisions-decisions";
import { DECISIONS_TOKEN_PACKED_CARD_WIDTH } from "@/lib/decisions-token-layout";
import { TOYBOX_WIDE_MAX_CLASS } from "@/lib/toybox-layout";
import { serviceMessages } from "@/messages/service";

function placeAcrossRows(
  refs: readonly DecisionsDecisionsResourceRef[],
  rows: readonly TierRow[],
): TierPlacement[] {
  if (rows.length === 0) return [];
  return refs.map((ref, index) => ({
    ...ref,
    rowId: rows[index % rows.length]!.id,
    sort: Math.floor(index / rows.length),
  }));
}

function refsOfType(
  entities: readonly EntityInfo[],
  type: EntityInfo["type"],
  limit: number,
): DecisionsDecisionsResourceRef[] {
  const refs: DecisionsDecisionsResourceRef[] = [];
  for (const entity of entities) {
    if (entity.type !== type) continue;
    const ref = entityToResourceRef(entity);
    if (!ref) continue;
    refs.push(ref);
    if (refs.length >= limit) break;
  }
  return refs;
}

export function DecisionsBoardDevPage() {
  const catalog = useDecisionsDecisionsCatalog("kor");
  const copy = serviceMessages.ko.decisionsDecisions;
  const rows = useMemo(() => cloneDefaultRows(), []);

  const sections = useMemo((): Array<{
    id: string;
    title: string;
    pool: DecisionsDecisionsResourceRef[];
    rows?: TierRow[];
  }> => {
    if (catalog.entities.length === 0) return [];
    const cardPool = stampPresetIds(findPresetDef("cards-ironclad"), catalog.entities);
    const relicPool = stampPresetIds(findPresetDef("relics-shared"), catalog.entities);
    const potionPool = stampPresetIds(findPresetDef("potions-all"), catalog.entities);
    const monsterPool = stampPresetIds(findPresetDef("monsters-elite"), catalog.entities);
    const mixed: DecisionsDecisionsResourceRef[] = [];
    for (const type of DECISIONS_DECISIONS_RESOURCE_TYPES) {
      mixed.push(...refsOfType(catalog.entities, type, 8));
    }
    return [
      { id: "cards", title: "카드 (아이언클래드 스탬프)", pool: cardPool },
      {
        id: "cards-dense",
        title: "카드 한 줄 · 긴 라벨",
        pool: cardPool,
        rows: [{ id: "s", label: "조건부 추천", color: "gold" as const }],
      },
      { id: "relics", title: "유물 (공유 스탬프)", pool: relicPool },
      { id: "potions", title: "포션 (전체 스탬프)", pool: potionPool },
      { id: "monsters", title: "몬스터 (엘리트 스탬프)", pool: monsterPool },
      { id: "mixed", title: "타입 혼합 (각 8개)", pool: mixed },
    ];
  }, [catalog.entities]);

  if (catalog.loading) {
    return (
      <main className={`${TOYBOX_WIDE_MAX_CLASS} px-4 py-6`}>
        <ContentLoadingNotice label={copy.loading} />
      </main>
    );
  }

  return (
    <main className={`${TOYBOX_WIDE_MAX_CLASS} py-6`} data-decisions-board-lab="">
      <header className="space-y-2 px-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300/80">
          DEV / DECISIONS BOARD
        </p>
        <h1 className="font-service text-xl font-bold spire-gold">어려운 결정 보드 검수</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-zinc-400">
          375 프레임은 Toy Box `px-4` 셸을 포함해 실제 상세 페이지와 같은 343px 보드다.
          375에서 카드 너비는 약 {DECISIONS_TOKEN_PACKED_CARD_WIDTH.toFixed(1)}px, 6열.
          640 프레임은 `@xl` comfortable 72px 타일이다. 몬스터는 정적 폴백만 켠다.
        </p>
      </header>
      {sections.map((section) => {
        const sectionRows = section.rows ?? rows;
        const placements = placeAcrossRows(section.pool, sectionRows);
        return (
          <section key={section.id} className="mt-10 space-y-3" data-decisions-fixture={section.id}>
            <h2 className="px-4 font-service text-sm font-semibold text-zinc-200">
              {section.title}
              <span className="ml-2 font-mono text-xs text-zinc-500">{section.pool.length}</span>
            </h2>
            <div className="w-full overflow-x-auto sm:px-4">
              <div className="flex w-max items-start gap-6">
                <div className="w-[375px] shrink-0" data-decisions-fixture-frame="375">
                  <p className="mb-1 font-mono text-[10px] text-zinc-500">375</p>
                  <div className="px-4">
                    <DecisionsDecisionsBoard
                      rows={sectionRows}
                      placements={placements}
                      pool={section.pool}
                      entitiesByKey={catalog.entityMap}
                      serviceLocale="ko"
                      gameLocale="kor"
                      showNames={false}
                      selectedKey={null}
                      readOnly
                      disablePreview
                      showUnranked={false}
                      staticOnly
                    />
                  </div>
                </div>
                <div className="w-[640px] shrink-0" data-decisions-fixture-frame="640">
                  <p className="mb-1 font-mono text-[10px] text-zinc-500">640</p>
                  <DecisionsDecisionsBoard
                    rows={sectionRows}
                    placements={placements}
                    pool={section.pool}
                    entitiesByKey={catalog.entityMap}
                    serviceLocale="ko"
                    gameLocale="kor"
                    showNames={false}
                    selectedKey={null}
                    readOnly
                    disablePreview
                    showUnranked={false}
                    staticOnly
                  />
                </div>
              </div>
            </div>
          </section>
        );
      })}
    </main>
  );
}
