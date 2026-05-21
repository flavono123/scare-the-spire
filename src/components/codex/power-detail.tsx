"use client";

import { type ReactNode, useMemo, useState } from "react";
import Image from "@/components/ui/static-image";
import Link from "next/link";
import { CommentSection } from "@/components/comment-section";
import { buildCodexCommentThreadKey } from "@/lib/comment-threads";
import type { ServiceLocale } from "@/lib/i18n";
import type { EntityVersionDiff, STS2Change, STS2Patch } from "@/lib/types";
import { localizeHref } from "@/lib/i18n";
import { getCodexServiceMessages } from "@/lib/codex-service";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import {
  CodexCard,
  CodexPower,
  POWER_TYPE_CONFIG,
} from "@/lib/codex-types";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { DescriptionText } from "./codex-description";
import { EntityReferenceLinks, type CodexReferenceTarget } from "./entity-reference-links";
import { GameHoverTip, type HoverTipVariant } from "./hover-tip";
import { RichDescription } from "./rich-description";
import { STS2ChangeHistory } from "./sts2-change-history";
import { getRelatedCardIdsForPower } from "@/lib/codex-references";

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

interface PowerDetailProps {
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
  backToListTitle?: string;
  power: CodexPower;
  initialShowBeta?: boolean;
  patches?: STS2Patch[];
  changes?: STS2Change[];
  versionDiffs?: EntityVersionDiff[];
  entities?: EntityInfo[];
  relatedCards?: CodexCard[];
  onClose?: () => void;
}

function getPowerDetailLabels(serviceLocale: ServiceLocale) {
  return serviceLocale === "ko"
    ? {
        englishName: "영어명",
        negativeAllowed: "음수 허용",
        patchHistory: "패치 이력",
        noPatchHistory: "구조화 변경 없음",
      }
    : {
        englishName: "English name",
        negativeAllowed: "Negative allowed",
        patchHistory: "Patch History",
        noPatchHistory: "No structured changes",
      };
}

function getPowerHoverTipVariant(power: CodexPower): HoverTipVariant {
  if (power.type === "Buff") return "buff";
  if (power.type === "Debuff") return "debuff";
  return "default";
}

export function PowerDetail({
  serviceLocale,
  gameUi,
  backToListTitle,
  power,
  initialShowBeta = false,
  patches,
  changes,
  versionDiffs,
  entities,
  relatedCards = [],
  onClose,
}: PowerDetailProps) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const detailLabels = getPowerDetailLabels(serviceLocale);
  const typeConfig = POWER_TYPE_CONFIG[power.type];
  const [showBeta, setShowBeta] = useState(initialShowBeta && Boolean(power.betaImageUrl));
  const [commentCount, setCommentCount] = useState(0);
  const excludeSelf = useMemo(
    () => new Set([power.name, power.nameEn]),
    [power.name, power.nameEn],
  );
  const displayImageUrl = showBeta && power.betaImageUrl ? power.betaImageUrl : power.imageUrl;
  const typeLabel = gameUi.powers.types[power.type].label || serviceText.labels.powerTypes[power.type].label;
  const stackLabel = serviceText.labels.powerStackTypes[power.stackType] ?? power.stackType;
  const backTitle = backToListTitle ?? gameUi.nav.powers;
  const cardById = new Map(relatedCards.map((card) => [card.id, card]));
  const relatedCardTargets: CodexReferenceTarget[] = getRelatedCardIdsForPower(relatedCards, power.id)
    .map((cardId) => cardById.get(cardId))
    .filter((card): card is CodexCard => Boolean(card))
    .map((card) => {
      const href = `/compendium/cards/${card.id.toLowerCase()}`;
      return {
        id: card.id,
        href,
        title: card.name,
        entity: {
          id: card.id,
          nameEn: card.nameEn,
          nameKo: card.name,
          imageUrl: card.imageUrl,
          href,
          color: card.color,
          type: "card" as const,
          cardData: card,
        },
      };
    });

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href={localizeHref("/compendium/powers", serviceLocale)}
          className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
          onClick={(e) => {
            if (onClose) {
              e.preventDefault();
              onClose();
            }
          }}
        >
          ← {backTitle}
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-white/10"
            aria-label={serviceText.common.close}
          >
            ✕
          </button>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] lg:items-start">
        <section className="flex min-h-[22rem] flex-col items-center justify-center gap-5 py-4">
          <div className="flex w-full flex-col items-center justify-center gap-5 md:flex-row md:items-center">
            <div className="flex shrink-0 flex-col items-center gap-3">
              <div className="flex h-32 w-32 items-center justify-center sm:h-40 sm:w-40">
                {displayImageUrl ? (
                  <Image
                    src={displayImageUrl}
                    alt={power.name}
                    width={160}
                    height={160}
                    className="h-full w-full object-contain drop-shadow-lg"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl text-gray-600">
                    ?
                  </div>
                )}
              </div>

              {power.betaImageUrl && (
                <button
                  onClick={() => setShowBeta((v) => !v)}
                  className={`rounded-lg border px-3 py-1 text-xs transition-all ${
                    showBeta
                      ? "border-purple-500/50 bg-purple-500/20 text-purple-400"
                      : "border-white/10 bg-white/5 text-gray-400 hover:border-white/30"
                  }`}
                >
                  {serviceText.cardsView.toggles.betaArt}
                </button>
              )}
            </div>

            <GameHoverTip
              title={power.name}
              variant={getPowerHoverTipVariant(power)}
              className="w-full max-w-[23rem]"
              style={{ minWidth: 280 }}
            >
              {entities ? (
                <RichDescription
                  description={power.description}
                  entities={entities}
                  excludeEntityTerms={excludeSelf}
                  className="block text-left"
                />
              ) : (
                <DescriptionText description={power.description} className="block text-left" />
              )}
            </GameHoverTip>
          </div>
        </section>

        <aside className="flex flex-col gap-3">
          <section className="rounded-lg border border-white/10 bg-black/20 px-4 py-3">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <MetaPill value={typeLabel} color={typeConfig.color} />
                <MetaPill value={stackLabel} />
                {power.allowNegative && (
                  <MetaPill value={detailLabels.negativeAllowed} color="#ef5350" />
                )}
              </div>
              {power.nameEn !== power.name && (
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">{detailLabels.englishName}</div>
                  <div className="font-game-text text-sm text-gray-300">{power.nameEn}</div>
                </div>
              )}
            </div>
          </section>

          <EntityReferenceLinks
            kind="card"
            serviceLocale={serviceLocale}
            targets={relatedCardTargets}
          />

          <InfoRailSection title={detailLabels.patchHistory}>
            <STS2ChangeHistory
              serviceLocale={serviceLocale}
              entityType="power"
              entityId={power.id}
              changes={changes}
              versionDiffs={versionDiffs}
              patches={patches}
              emptyLabel={detailLabels.noPatchHistory}
            />
          </InfoRailSection>

          <InfoRailSection title={`${serviceText.common.comments}${commentCount > 0 ? ` (${commentCount})` : ""}`}>
            <CommentSection
              threadKey={buildCodexCommentThreadKey("power", power.id)}
              onCountChange={setCommentCount}
            />
          </InfoRailSection>
        </aside>
      </div>
    </div>
  );
}
