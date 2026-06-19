"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import Image from "@/components/ui/static-image";
import Link from "next/link";
import { CommentSection } from "@/components/comment-section";
import { buildCodexCommentThreadKey } from "@/lib/comment-threads";
import type { ServiceLocale } from "@/lib/i18n";
import { localizeHref } from "@/lib/i18n";
import { getCodexServiceMessages } from "@/lib/codex-service";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import type { EntityInfo } from "@/components/patch-note-renderer";
import type {
  CodexAncient,
  CodexCard,
  CodexEpoch,
  CodexPotion,
  CodexRelic,
  EpochAffiliation,
} from "@/lib/codex-types";
import { DescriptionText } from "./codex-description";
import { EntityReferenceGroupLinks, type CodexReferenceTarget } from "./entity-reference-links";
import { RichDescription } from "./rich-description";
import { GameCheckboxToggle } from "./game-checkbox";
import {
  notifyCodexUrlChange,
  useHydrationSafeSearchParam,
} from "./use-hydration-safe-search-param";
import {
  getEpochAffiliationColor,
  getEpochAffiliationLabel,
  getEpochUnlockConditionColor,
  getEpochUnlockConditionLabel,
  getEpochUnlockRewardColor,
  getEpochUnlockRewardLabel,
} from "./epoch-display";

const EPOCH_ANCIENT_AFFILIATION_IDS: Partial<Record<EpochAffiliation, string>> = {
  darv: "DARV",
  neow: "NEOW",
  nonupeipe: "NONUPEIPE",
  orobas: "OROBAS",
  pael: "PAEL",
  tanx: "TANX",
  tezcatara: "TEZCATARA",
  vakuu: "VAKUU",
};

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

function getEpochDetailLabels(serviceLocale: ServiceLocale) {
  return serviceLocale === "ko"
    ? {
        englishName: "영어명",
        unlockInfo: "해금 조건",
        unlockText: "해금 내용",
      }
    : {
        englishName: "English name",
        unlockInfo: "Unlock condition",
        unlockText: "Unlock text",
      };
}

function isBetaArtParamEnabled(value: string | null): boolean {
  const normalized = value?.toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

interface EpochDetailProps {
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
  backToListTitle?: string;
  epoch: CodexEpoch;
  cards?: CodexCard[];
  relics?: CodexRelic[];
  potions?: CodexPotion[];
  ancients?: CodexAncient[];
  epochs?: CodexEpoch[];
  entities?: EntityInfo[];
  initialShowBeta?: boolean;
  onShowBetaChange?: (showBeta: boolean) => void;
  syncBetaSearchParam?: boolean;
  onClose?: () => void;
}

export function EpochDetail({
  serviceLocale,
  gameUi,
  backToListTitle,
  epoch,
  cards = [],
  relics = [],
  potions = [],
  ancients = [],
  epochs = [],
  entities,
  initialShowBeta = false,
  onShowBetaChange,
  syncBetaSearchParam = false,
  onClose,
}: EpochDetailProps) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const detailLabels = getEpochDetailLabels(serviceLocale);
  const [commentCount, setCommentCount] = useState(0);
  const [uncontrolledShowBeta, setUncontrolledShowBeta] = useState(() => initialShowBeta && Boolean(epoch.betaImageUrl));
  const urlBetaArt = useHydrationSafeSearchParam("beta", initialShowBeta ? "true" : null);
  const searchParamShowBeta = syncBetaSearchParam && urlBetaArt !== null
    ? isBetaArtParamEnabled(urlBetaArt)
    : null;
  const isShowBetaControlled = onShowBetaChange !== undefined;
  const showBeta = isShowBetaControlled
    ? initialShowBeta && Boolean(epoch.betaImageUrl)
    : (searchParamShowBeta ?? uncontrolledShowBeta) && Boolean(epoch.betaImageUrl);
  const displayImageUrl = showBeta && epoch.betaImageUrl
    ? epoch.betaImageUrl
    : epoch.imageUrl ?? epoch.betaImageUrl;
  const setShowBeta = useCallback((checked: boolean) => {
    const next = checked && Boolean(epoch.betaImageUrl);
    if (!isShowBetaControlled) setUncontrolledShowBeta(next);
    onShowBetaChange?.(next);
  }, [epoch.betaImageUrl, isShowBetaControlled, onShowBetaChange]);

  useEffect(() => {
    if (!syncBetaSearchParam) return;

    const url = new URL(window.location.href);
    if (showBeta) {
      url.searchParams.set("beta", "true");
    } else {
      url.searchParams.delete("beta");
    }

    if (url.toString() !== window.location.href) {
      window.history.replaceState(null, "", url.toString());
      notifyCodexUrlChange();
    }
  }, [showBeta, syncBetaSearchParam]);
  const excludeSelf = useMemo(
    () => new Set([epoch.name, epoch.nameEn]),
    [epoch.name, epoch.nameEn],
  );
  const isModal = Boolean(onClose);
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const relicById = new Map(relics.map((relic) => [relic.id, relic]));
  const potionById = new Map(potions.map((potion) => [potion.id, potion]));
  const ancientById = new Map(ancients.map((ancient) => [ancient.id, ancient]));
  const epochById = new Map(epochs.map((item) => [item.id, item]));

  const relatedCardTargets = epoch.unlocksCards
    .map((cardId) => cardById.get(cardId))
    .filter((card): card is CodexCard => Boolean(card))
    .map(cardToReferenceTarget);
  const relatedRelicTargets = epoch.unlocksRelics
    .map((relicId) => relicById.get(relicId))
    .filter((relic): relic is CodexRelic => Boolean(relic))
    .map(relicToReferenceTarget);
  const relatedPotionTargets = epoch.unlocksPotions
    .map((potionId) => potionById.get(potionId))
    .filter((potion): potion is CodexPotion => Boolean(potion))
    .map(potionToReferenceTarget);
  const relatedAncientTargets = epoch.affiliations
    .map((affiliation) => EPOCH_ANCIENT_AFFILIATION_IDS[affiliation])
    .filter((ancientId): ancientId is string => Boolean(ancientId))
    .map((ancientId) => ancientById.get(ancientId))
    .filter((ancient): ancient is CodexAncient => Boolean(ancient))
    .map(ancientToReferenceTarget);
  const relatedEpochTargets = epoch.expandsTimeline
    .map((epochId) => epochById.get(epochId))
    .filter((item): item is CodexEpoch => Boolean(item))
    .map(epochToReferenceTarget);

  const rootClassName = isModal
    ? "mx-auto w-full max-w-[92rem] p-3 sm:p-4"
    : "mx-auto w-full max-w-[92rem] p-4 sm:p-6";
  const eraLabel = epoch.eraName
    ? epoch.eraYear ? `${epoch.eraName} ${epoch.eraYear}` : epoch.eraName
    : epoch.eraGroup;

  return (
    <div className={rootClassName}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href={localizeHref("/compendium/epochs", serviceLocale)}
          className="text-sm text-gray-400 transition-colors hover:text-gray-200"
          onClick={(event) => {
            if (onClose) {
              event.preventDefault();
              onClose();
            }
          }}
        >
          ← {backToListTitle ?? gameUi.epochsTitle}
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

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] lg:items-start">
        <section className="flex min-h-[24rem] min-w-0 flex-col items-center justify-center py-2">
          <div
            className="relative min-w-0 w-full overflow-hidden rounded-xl bg-black shadow-2xl ring-1 ring-white/10"
            style={{ boxShadow: "inset 0 0 120px rgba(96, 165, 250, 0.08), 0 16px 60px rgba(0, 0, 0, 0.35)" }}
          >
            <div className="relative h-[36rem] w-full sm:h-auto sm:aspect-[16/10]">
              {displayImageUrl ? (
                <Image
                  src={displayImageUrl}
                  alt={epoch.name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 68vw"
                  className="object-cover"
                  priority={Boolean(onClose)}
                />
              ) : (
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_35%,rgba(96,165,250,0.20),transparent_34%),linear-gradient(135deg,#111827,#050505_65%)]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-l from-black/90 via-black/45 to-black/10" />
              <div className="absolute inset-x-4 bottom-4 top-4 flex min-w-0 flex-col sm:inset-x-auto sm:bottom-[5%] sm:right-[4%] sm:top-[5%] sm:w-[48%] sm:min-w-[360px] sm:max-w-[560px]">
                <div className="relative flex min-h-0 flex-1 flex-col">
                  <div className="pointer-events-none absolute -inset-6 rounded-full bg-black/35 blur-2xl" />
                  <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto pr-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <div className="mb-2 flex flex-wrap gap-2">
                      <MetaPill value={gameUi.epochsTitle} color="#f3c640" />
                      <MetaPill value={eraLabel} color="#60a5fa" />
                    </div>
                    <h1
                      className="font-game-title text-3xl font-bold leading-tight text-[#f3c640]"
                      style={{ textShadow: "2px 2px 0 rgba(0,0,0,0.65), 0 0 14px rgba(0,0,0,0.5)" }}
                    >
                      {epoch.name}
                    </h1>
                    <div className="mt-4 font-game-text text-[15px] leading-relaxed text-zinc-100 drop-shadow-[0_2px_3px_rgba(0,0,0,0.75)]">
                      {entities ? (
                        <RichDescription
                          description={epoch.description}
                          entities={entities}
                          excludeEntityTerms={excludeSelf}
                        />
                      ) : (
                        <DescriptionText description={epoch.description} />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {epoch.betaImageUrl && (
            <div className="mt-3 flex max-w-full justify-center">
              <GameCheckboxToggle
                checked={showBeta}
                onCheckedChange={setShowBeta}
                label={serviceText.cardsView.toggles.betaArt}
                size="md"
              />
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-3">
          <section className="rounded-lg border border-white/10 bg-black/20 px-4 py-3">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {epoch.affiliations.map((affiliation) => (
                  <MetaPill
                    key={affiliation}
                    value={getEpochAffiliationLabel(affiliation, serviceText, serviceLocale)}
                    color={getEpochAffiliationColor(affiliation)}
                  />
                ))}
                {epoch.unlockConditions.map((condition) => (
                  <MetaPill
                    key={condition}
                    value={getEpochUnlockConditionLabel(condition, serviceLocale)}
                    color={getEpochUnlockConditionColor(condition)}
                  />
                ))}
                {epoch.unlockRewards.map((reward) => (
                  <MetaPill
                    key={reward}
                    value={getEpochUnlockRewardLabel(reward, serviceLocale)}
                    color={getEpochUnlockRewardColor(reward)}
                  />
                ))}
              </div>
              {epoch.nameEn !== epoch.name && (
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">{detailLabels.englishName}</div>
                  <div className="font-game-text text-sm text-gray-300">{epoch.nameEn}</div>
                </div>
              )}
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">{detailLabels.unlockInfo}</div>
                <p className="font-game-text text-sm leading-relaxed text-gray-300">
                  {entities ? (
                    <RichDescription
                      description={epoch.unlockInfo}
                      entities={entities}
                      excludeEntityTerms={excludeSelf}
                    />
                  ) : (
                    <DescriptionText description={epoch.unlockInfo} />
                  )}
                </p>
              </div>
              {epoch.unlockText && (
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">{detailLabels.unlockText}</div>
                  <p className="font-game-text text-sm leading-relaxed text-gray-300">
                    {entities ? (
                      <RichDescription
                        description={epoch.unlockText}
                        entities={entities}
                        excludeEntityTerms={excludeSelf}
                      />
                    ) : (
                      <DescriptionText description={epoch.unlockText} />
                    )}
                  </p>
                </div>
              )}
            </div>
          </section>

          <EntityReferenceGroupLinks
            gameUi={gameUi}
            serviceLocale={serviceLocale}
            groups={[
              { kind: "card", targets: relatedCardTargets },
              { kind: "relic", targets: relatedRelicTargets },
              { kind: "potion", targets: relatedPotionTargets },
              { kind: "ancient", targets: relatedAncientTargets },
              { kind: "epoch", targets: relatedEpochTargets },
            ]}
          />

          <InfoRailSection title={`${serviceText.common.comments}${commentCount > 0 ? ` (${commentCount})` : ""}`}>
            <CommentSection
              threadKey={buildCodexCommentThreadKey("epoch", epoch.id)}
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

function potionToReferenceTarget(potion: CodexPotion): CodexReferenceTarget {
  const href = `/compendium/potions/${potion.id.toLowerCase()}`;
  return {
    href,
    id: potion.id,
    title: potion.name,
    entity: {
      id: potion.id,
      nameEn: potion.nameEn,
      nameKo: potion.name,
      imageUrl: potion.imageUrl,
      href,
      color: potion.pool,
      type: "potion",
      potionData: potion,
    },
  };
}

function ancientToReferenceTarget(ancient: CodexAncient): CodexReferenceTarget {
  const href = `/compendium/ancients/${ancient.id.toLowerCase()}`;
  return {
    href,
    id: ancient.id,
    title: ancient.name,
    entity: {
      id: ancient.id,
      nameEn: ancient.nameEn,
      nameKo: ancient.name,
      imageUrl: ancient.imageUrl,
      href,
      color: ancient.act ?? "ancient",
      type: "ancient",
      ancientData: ancient,
    },
  };
}

function epochToReferenceTarget(epoch: CodexEpoch): CodexReferenceTarget {
  const href = `/compendium/epochs/${epoch.id.toLowerCase()}`;
  return {
    href,
    id: epoch.id,
    title: epoch.name,
    entity: {
      id: epoch.id,
      nameEn: epoch.nameEn,
      nameKo: epoch.name,
      imageUrl: epoch.imageUrl,
      href,
      color: epoch.affiliation,
      type: "epoch",
      epochData: epoch,
    },
  };
}
