"use client";

import { type ReactNode, useMemo, useState } from "react";
import Image from "@/components/ui/static-image";
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
import type { CodexAncient, CodexCard, CodexRelic, AncientDialogueLine } from "@/lib/codex-types";
import {
  EVENT_ACT_UNKNOWN,
  CHARACTER_COLORS,
} from "@/lib/codex-types";
import { DescriptionText } from "./codex-description";
import { EntityReferenceGroupLinks, type CodexReferenceTarget } from "./entity-reference-links";
import { RichDescription } from "./rich-description";
import { STS2ChangeHistory } from "./sts2-change-history";
import {
  getRelatedCardIdsForAncient,
  getRelatedRelicIdsForAncient,
} from "@/lib/codex-references";

const CHARACTERS = [
  { key: "Ironclad", pool: "ironclad", color: CHARACTER_COLORS.ironclad },
  { key: "Silent", pool: "silent", color: CHARACTER_COLORS.silent },
  { key: "Defect", pool: "defect", color: CHARACTER_COLORS.defect },
  { key: "Necrobinder", pool: "necrobinder", color: CHARACTER_COLORS.necrobinder },
  { key: "Regent", pool: "regent", color: CHARACTER_COLORS.regent },
] as const;

const SPECIAL_TABS = [
  { key: "First Visit", labelKey: "firstVisit" },
  { key: "Returning", labelKey: "returning" },
] as const;

const ANCIENT_BACKGROUND_IDS = new Set([
  "darv",
  "neow",
  "orobas",
  "pael",
  "tanx",
  "tezcatara",
]);

function ancientBackgroundImageUrl(ancientId: string): string | null {
  const slug = ancientId.toLowerCase();
  return ANCIENT_BACKGROUND_IDS.has(slug)
    ? `/images/sts2/ancients-bg/${slug}_bg.webp`
    : null;
}

const ANCIENT_DIALOGUE_EXCLUDED_ENTITY_TYPES = new Set<EntityInfo["type"]>(["epoch"]);


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
        firstLine: "첫 조우",
        patchHistory: "패치 이력",
        noPatchHistory: "구조화 변경 없음",
      }
    : {
        englishName: "English name",
        englishEpithet: "English epithet",
        firstLine: "First Encounter",
        patchHistory: "Patch History",
        noPatchHistory: "No structured changes",
      };
}

function getAncientActLabel(
  ancient: CodexAncient,
  serviceText: CodexServiceMessages,
  gameUi: CodexGameUiLabels,
): string {
  return ancient.act ? gameUi.acts[ancient.act] : serviceText.labels.acts.none;
}

// --- Dialogue viewer ---
function DialogueViewer({
  dialogue,
  ancientName,
  messages,
  entities,
  excludeSelf,
}: {
  dialogue: Record<string, AncientDialogueLine[]>;
  ancientName: string;
  messages: CodexServiceMessages;
  entities?: EntityInfo[];
  excludeSelf?: ReadonlySet<string>;
}) {
  const availableTabs = useMemo(() => {
    const characterTabs = CHARACTERS
      .filter((ch) => (dialogue[ch.key]?.length ?? 0) > 0)
      .map((ch) => ({
        key: ch.key,
        label: messages.labels.pools[ch.pool],
        color: ch.color,
        special: false,
      }));
    const specialTabs = SPECIAL_TABS
      .filter((tab) => (dialogue[tab.key]?.length ?? 0) > 0)
      .map((tab) => ({
        key: tab.key,
        label: messages.ancientsView[tab.labelKey],
        color: "#60a5fa",
        special: true,
      }));
    return [...characterTabs, ...specialTabs];
  }, [dialogue, messages]);

  const [activeTab, setActiveTab] = useState(() => availableTabs[0]?.key ?? "Ironclad");
  const resolvedActiveTab = availableTabs.some((tab) => tab.key === activeTab)
    ? activeTab
    : availableTabs[0]?.key ?? activeTab;
  const lines = dialogue[resolvedActiveTab] ?? [];

  return (
    <div>
      {/* Character tabs */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {availableTabs.map((tab) => {
          const isActive = resolvedActiveTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                isActive
                  ? "border-current bg-current/10"
                  : "border-zinc-700/40 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600"
              }`}
              style={isActive ? { color: tab.color, borderColor: tab.color } : undefined}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Dialogue lines */}
      <div className="space-y-3">
        {lines.map((line, i) => {
          const isAncient = line.speaker === "ancient";
          const charConfig = CHARACTERS.find((c) => c.key === activeTab);
          return (
            <div
              key={`${activeTab}-${i}`}
              className={`flex gap-3 ${isAncient ? "" : "justify-end"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                  isAncient
                    ? "bg-blue-500/10 border border-blue-500/20 text-blue-100"
                    : "bg-zinc-800/80 border border-zinc-700/40 text-zinc-300"
                }`}
              >
                <div className="text-[10px] font-medium mb-1 opacity-60">
                  {isAncient ? ancientName : charConfig ? messages.labels.pools[charConfig.pool] : activeTab}
                </div>
                {entities ? (
                  <RichDescription
                    description={line.text}
                    entities={entities}
                    excludeEntityTerms={excludeSelf}
                    excludeEntityTypes={ANCIENT_DIALOGUE_EXCLUDED_ENTITY_TYPES}
                  />
                ) : (
                  <DescriptionText description={line.text} />
                )}
              </div>
            </div>
          );
        })}
        {lines.length === 0 && (
          <p className="text-sm text-zinc-600 italic">{messages.ancientsView.noDialogue}</p>
        )}
      </div>
    </div>
  );
}

// --- Main component ---
interface AncientDetailProps {
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
  backToListTitle?: string;
  ancient: CodexAncient;
  cards?: CodexCard[];
  relics: CodexRelic[];
  onClose?: () => void;
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
  relics,
  onClose,
  entities,
  patches,
  changes,
  versionDiffs,
}: AncientDetailProps) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const detailLabels = getAncientDetailLabels(serviceLocale);
  const backgroundImageUrl = ancientBackgroundImageUrl(ancient.id);
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
          className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
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
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-white/10"
            aria-label={serviceText.common.close}
          >
            ✕
          </button>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] lg:items-start">
        <section className="flex min-h-[24rem] flex-col items-center justify-center py-4">
          {backgroundImageUrl ? (
            <div className="relative w-full max-w-[48rem] overflow-hidden rounded-lg border border-blue-900/30 bg-[#070910] shadow-2xl shadow-black/40">
              <div className="relative h-56 w-full sm:aspect-[2560/1200] sm:h-auto">
                <Image
                  src={backgroundImageUrl}
                  alt={ancient.name}
                  fill
                  sizes="(max-width: 1024px) 92vw, 48rem"
                  className="object-cover"
                  priority
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent px-5 pb-5 pt-16">
                  <h1 className="font-game-title text-3xl text-blue-200 drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">
                    {ancient.name}
                  </h1>
                  {ancient.epithet && (
                    <p className="mt-1 font-game-text text-sm italic text-blue-100/75">
                      &ldquo;{ancient.epithet}&rdquo;
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[22rem] w-full flex-col items-center justify-center gap-4">
              <div className="relative flex h-64 w-64 items-center justify-center sm:h-72 sm:w-72">
                <Image
                  src={ancient.imageUrl ?? "/images/sts2/nav/stats_ancients.png"}
                  alt=""
                  fill
                  sizes="18rem"
                  className="object-contain opacity-20 blur-2xl"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Image
                    src={ancient.imageUrl ?? "/images/sts2/nav/stats_ancients.png"}
                    alt={ancient.name}
                    width={288}
                    height={288}
                    className="max-h-full max-w-full object-contain drop-shadow-[0_0_28px_rgba(96,165,250,0.35)]"
                    priority
                  />
                </div>
              </div>
              <div className="text-center">
                <h1 className="font-game-title text-3xl text-blue-200">{ancient.name}</h1>
                {ancient.epithet && (
                  <p className="mt-1 font-game-text text-sm italic text-blue-100/75">
                    &ldquo;{ancient.epithet}&rdquo;
                  </p>
                )}
              </div>
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-3">
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
              {ancient.description && (
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">{detailLabels.firstLine}</div>
                  <p className="font-game-text text-sm leading-relaxed text-gray-300">
                    {entities ? (
                      <RichDescription
                        description={ancient.description}
                        entities={entities}
                        excludeEntityTerms={excludeSelf}
                      />
                    ) : (
                      <DescriptionText description={ancient.description} />
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
            ]}
          />

          <InfoRailSection title={serviceText.ancientsView.dialogue}>
            <div className="max-h-[32rem] overflow-y-auto pr-1">
              <DialogueViewer
                dialogue={ancient.dialogue}
                ancientName={ancient.name}
                messages={serviceText}
                entities={entities}
                excludeSelf={excludeSelf}
              />
            </div>
          </InfoRailSection>

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
