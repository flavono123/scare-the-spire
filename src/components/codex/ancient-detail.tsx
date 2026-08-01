"use client";

import { type ReactNode, type Ref, useMemo, useState } from "react";
import Link from "next/link";
import { CommentSection } from "@/components/comment-section";
import { buildCodexCommentThreadKey } from "@/lib/comment-threads";
import type { ServiceLocale } from "@/lib/i18n";
import { localizeHref } from "@/lib/i18n";
import type { EntityVersionDiff, STS2Change, STS2Patch } from "@/lib/types";
import type { EntityInfo } from "@/components/patch-note-renderer";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import {
  formatTemplateCount,
  getCodexServiceMessages,
  type CodexServiceMessages,
} from "@/lib/codex-service";
import type { CodexAncient, CodexCard, CodexCharacter, CodexRelic } from "@/lib/codex-types";
import { EVENT_ACT_UNKNOWN } from "@/lib/codex-types";
import { EntityReferenceGroupLinks, type CodexReferenceTarget } from "./entity-reference-links";
import { STS2ChangeHistory } from "./sts2-change-history";
import { AncientDialogueViewer } from "./ancient-dialogue-viewer";
import { AncientSceneStage } from "./ancient-scene-stage";
import {
  getRelatedCardIdsForAncient,
  getRelatedRelicIdsForAncient,
} from "@/lib/codex-references";

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

function getAncientDetailLabels(serviceLocale: ServiceLocale) {
  return serviceLocale === "ko"
    ? {
        englishName: "영어명",
        englishEpithet: "영어 이명",
        patchHistory: "패치 이력",
        noPatchHistory: "구조화 변경 없음",
        rewardRelics: "보상 유물",
      }
    : {
        englishName: "English name",
        englishEpithet: "English epithet",
        patchHistory: "Patch History",
        noPatchHistory: "No structured changes",
        rewardRelics: "Reward Relics",
      };
}

function getAncientActLabel(
  ancient: CodexAncient,
  serviceText: CodexServiceMessages,
  gameUi: CodexGameUiLabels,
): string {
  return ancient.act ? gameUi.acts[ancient.act] : serviceText.labels.acts.none;
}

// --- Main component ---
interface AncientDetailProps {
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
  backToListTitle?: string;
  ancient: CodexAncient;
  cards?: CodexCard[];
  characters: CodexCharacter[];
  relics: CodexRelic[];
  onClose?: () => void;
  closeButtonRef?: Ref<HTMLButtonElement>;
  entities?: EntityInfo[];
  patches?: STS2Patch[];
  changes?: STS2Change[];
  versionDiffs?: EntityVersionDiff[];
}

export function AncientDetail({
  serviceLocale,
  gameUi,
  backToListTitle,
  ancient,
  cards = [],
  characters,
  relics,
  onClose,
  closeButtonRef,
  entities,
  patches,
  changes,
  versionDiffs,
}: AncientDetailProps) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const detailLabels = getAncientDetailLabels(serviceLocale);
  const [commentCount, setCommentCount] = useState(0);
  const excludeSelf = useMemo(
    () => new Set([ancient.name, ancient.nameEn]),
    [ancient.name, ancient.nameEn],
  );
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const relicById = new Map(relics.map((relic) => [relic.id, relic]));
  const relatedCardTargets = getRelatedCardIdsForAncient(ancient, cards)
    .map((cardId) => cardById.get(cardId))
    .filter((card): card is CodexCard => Boolean(card))
    .map(cardToReferenceTarget);
  const relatedRelicTargets = getRelatedRelicIdsForAncient(ancient)
    .map((relicId) => relicById.get(relicId))
    .filter((relic): relic is CodexRelic => Boolean(relic))
    .map(relicToReferenceTarget);
  const actLabel = getAncientActLabel(ancient, serviceText, gameUi);
  const actPillClass = ancient.act
    ? "border-blue-500/40 bg-blue-500/10 text-blue-300"
    : `${EVENT_ACT_UNKNOWN.border} ${EVENT_ACT_UNKNOWN.bg} ${EVENT_ACT_UNKNOWN.color}`;

  return (
    <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href={localizeHref("/compendium/ancients", serviceLocale)}
          className="flex min-h-11 items-center text-sm text-gray-400 transition-colors hover:text-gray-200"
          onClick={(e) => {
            if (onClose) {
              e.preventDefault();
              onClose();
            }
          }}
        >
          ← {backToListTitle ?? serviceText.ancientsView.backToList}
        </Link>
        {onClose && (
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-300"
            aria-label={serviceText.common.close}
          >
            ✕
          </button>
        )}
      </div>

      <div className="space-y-5">
        <section>
          <AncientSceneStage ancient={ancient}>
            <div className="pointer-events-none absolute inset-x-2 top-2 z-20 flex justify-center sm:top-3">
              <div className="max-w-[85%] rounded-lg border border-blue-200/25 bg-gradient-to-r from-blue-950/90 via-teal-950/90 to-blue-950/90 px-5 py-2 text-center shadow-xl">
                <h1
                  id={`ancient-detail-title-${ancient.id.toLowerCase()}`}
                  className="font-game-title text-xl text-blue-100 drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)] sm:text-2xl"
                >
                  {ancient.name}
                </h1>
                {ancient.epithet && (
                  <p className="truncate font-game-text text-xs italic text-blue-100/80 sm:text-sm">
                    &ldquo;{ancient.epithet}&rdquo;
                  </p>
                )}
              </div>
            </div>
            <AncientDialogueViewer
              key={ancient.id}
              ancient={ancient}
              characters={characters}
              serviceLocale={serviceLocale}
              messages={serviceText}
              entities={entities}
              excludeSelf={excludeSelf}
            />
          </AncientSceneStage>
        </section>

        <aside className="grid items-start gap-3 lg:grid-cols-2">
          <section className="rounded-lg border border-white/10 bg-black/20 px-4 py-3">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <MetaPill value={gameUi.ancientsTitle} color="#60a5fa" />
                <span className={`rounded-md border px-3 py-1.5 font-game-text text-sm font-bold ${actPillClass}`}>
                  {actLabel}
                </span>
                <MetaPill value={formatTemplateCount(serviceText.ancientsView.relicCount, ancient.relicIds.length)} />
              </div>
              {ancient.nameEn !== ancient.name && (
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">{detailLabels.englishName}</div>
                  <div className="font-game-text text-sm text-gray-300">{ancient.nameEn}</div>
                </div>
              )}
              {ancient.epithetEn && ancient.epithetEn !== ancient.epithet && (
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">{detailLabels.englishEpithet}</div>
                  <div className="font-game-text text-sm text-gray-300">{ancient.epithetEn}</div>
                </div>
              )}
            </div>
          </section>

          <EntityReferenceGroupLinks
            gameUi={gameUi}
            serviceLocale={serviceLocale}
            groups={[
              { kind: "card", targets: relatedCardTargets },
              { kind: "relic", targets: relatedRelicTargets, label: detailLabels.rewardRelics, layout: "grid" },
            ]}
          />

          <InfoRailSection title={detailLabels.patchHistory}>
            <STS2ChangeHistory
              serviceLocale={serviceLocale}
              entityType="ancient"
              entityId={ancient.id}
              changes={changes}
              versionDiffs={versionDiffs}
              patches={patches}
              introducedInPatch={ancient.introducedInPatch}
              deprecatedInPatch={ancient.deprecatedInPatch}
              emptyLabel={detailLabels.noPatchHistory}
            />
          </InfoRailSection>

          <InfoRailSection title={`${serviceText.common.comments}${commentCount > 0 ? ` (${commentCount})` : ""}`}>
            <CommentSection
              threadKey={buildCodexCommentThreadKey("ancient", ancient.id)}
              onCountChange={setCommentCount}
            />
          </InfoRailSection>
        </aside>
      </div>
    </div>
  );
}

function cardToReferenceTarget(card: CodexCard): CodexReferenceTarget {
  const href = `/compendium/cards/${card.id.toLowerCase()}`;
  return {
    href,
    id: card.id,
    title: card.name,
    entity: {
      id: card.id,
      nameEn: card.nameEn,
      nameKo: card.name,
      imageUrl: card.imageUrl,
      href,
      color: card.color,
      type: "card",
      cardData: card,
    },
  };
}

function relicToReferenceTarget(relic: CodexRelic): CodexReferenceTarget {
  const href = `/compendium/relics/${relic.id.toLowerCase()}`;
  return {
    href,
    id: relic.id,
    title: relic.name,
    entity: {
      id: relic.id,
      nameEn: relic.nameEn,
      nameKo: relic.name,
      imageUrl: relic.imageUrl,
      href,
      color: relic.pool,
      type: "relic",
      relicData: relic,
    },
  };
}
