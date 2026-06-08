"use client";

import { type ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import { CommentSection } from "@/components/comment-section";
import { buildCodexCommentThreadKey } from "@/lib/comment-threads";
import { getCodexServiceMessages } from "@/lib/codex-service";
import { stripCodexMarkup } from "@/lib/codex-search";
import { localizeHref, type ServiceLocale } from "@/lib/i18n";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import type { CodexCard, CodexKeyword } from "@/lib/codex-types";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { DescriptionText } from "./codex-description";
import { EntityReferenceGroupLinks, type CodexReferenceTarget } from "./entity-reference-links";
import { GameHoverTip } from "./hover-tip";
import { RichDescription } from "./rich-description";

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

interface KeywordDetailProps {
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
  backToListTitle?: string;
  keyword: CodexKeyword;
  relatedCards?: CodexCard[];
  entities?: EntityInfo[];
  onClose?: () => void;
}

const KEYWORD_SOURCE_CONFIG: Record<CodexKeyword["source"], { color: string; label: Record<ServiceLocale, string> }> = {
  cardKeyword: {
    color: "#efc851",
    label: { ko: "카드 키워드", en: "Card keyword" },
  },
  staticHoverTip: {
    color: "#7dd3fc",
    label: { ko: "툴팁 키워드", en: "Hover tip" },
  },
};

function keywordDetailLabels(serviceLocale: ServiceLocale) {
  return serviceLocale === "ko"
    ? {
        englishName: "영어명",
      }
    : {
        englishName: "English name",
      };
}

const KEYWORD_DESCRIPTION_EXCLUDED_ENTITY_TYPES = new Set<EntityInfo["type"]>(["epoch"]);

function normalizedTerms(keyword: CodexKeyword): string[] {
  return Array.from(new Set([keyword.name, keyword.nameEn]
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean)));
}

function cardMentionsKeyword(card: CodexCard, keyword: CodexKeyword): boolean {
  const terms = normalizedTerms(keyword);
  const labels = [...card.keywords, ...Object.values(card.keywordLabels)]
    .map((label) => label.trim().toLowerCase())
    .filter(Boolean);
  if (labels.some((label) => terms.includes(label))) return true;

  const descriptions = [
    card.description,
    card.descriptionEn,
    card.descriptionRaw,
    card.descriptionRawEn,
  ].map((description) => stripCodexMarkup(description).toLowerCase());

  return terms.some((term) => descriptions.some((description) => description.includes(term)));
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

export function KeywordDetail({
  serviceLocale,
  gameUi,
  backToListTitle,
  keyword,
  relatedCards = [],
  entities,
  onClose,
}: KeywordDetailProps) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const labels = keywordDetailLabels(serviceLocale);
  const sourceConfig = KEYWORD_SOURCE_CONFIG[keyword.source];
  const [commentCount, setCommentCount] = useState(0);
  const excludeSelf = useMemo(
    () => new Set([keyword.name, keyword.nameEn]),
    [keyword.name, keyword.nameEn],
  );
  const relatedCardTargets = useMemo(
    () => relatedCards
      .filter((card) => cardMentionsKeyword(card, keyword))
      .sort((a, b) => a.name.localeCompare(b.name, "ko"))
      .map(cardToReferenceTarget),
    [keyword, relatedCards],
  );
  const backTitle = backToListTitle ?? gameUi.nav.keywords;

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href={localizeHref("/compendium/keywords", serviceLocale)}
          className="text-sm text-gray-400 transition-colors hover:text-gray-200"
          onClick={(event) => {
            if (onClose) {
              event.preventDefault();
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
        <section className="flex min-h-[18rem] items-center justify-center py-4">
          <GameHoverTip
            title={keyword.name}
            className="w-full max-w-[28rem]"
            style={{ minWidth: 280 }}
          >
            {entities ? (
              <RichDescription
                description={keyword.description}
                entities={entities}
                excludeEntityTerms={excludeSelf}
                excludeEntityTypes={KEYWORD_DESCRIPTION_EXCLUDED_ENTITY_TYPES}
                className="block text-left"
              />
            ) : (
              <DescriptionText description={keyword.description} className="block text-left" />
            )}
          </GameHoverTip>
        </section>

        <aside className="flex flex-col gap-3">
          <section className="rounded-lg border border-white/10 bg-black/20 px-4 py-3">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <MetaPill value={sourceConfig.label[serviceLocale]} color={sourceConfig.color} />
              </div>
              {keyword.nameEn !== keyword.name && (
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">{labels.englishName}</div>
                  <div className="font-game-text text-sm text-gray-300">{keyword.nameEn}</div>
                </div>
              )}
            </div>
          </section>

          <EntityReferenceGroupLinks
            gameUi={gameUi}
            groups={[{ kind: "card", targets: relatedCardTargets }]}
            serviceLocale={serviceLocale}
          />

          <InfoRailSection title={`${serviceText.common.comments}${commentCount > 0 ? ` (${commentCount})` : ""}`}>
            <CommentSection
              threadKey={buildCodexCommentThreadKey("keyword", keyword.id)}
              onCountChange={setCommentCount}
            />
          </InfoRailSection>
        </aside>
      </div>
    </div>
  );
}
