"use client";

import { useMemo, useState } from "react";
import Image from "@/components/ui/static-image";
import Link from "next/link";
import { CommentSection } from "@/components/comment-section";
import { buildCodexCommentThreadKey } from "@/lib/comment-threads";
import type { ServiceLocale } from "@/lib/i18n";
import { localizeHref } from "@/lib/i18n";
import { getCodexServiceMessages } from "@/lib/codex-service";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import {
  CodexRelic,
  RELIC_RARITY_COLORS,
  characterOutlineFilter,
  getCharacterColor,
  CHARACTER_COLORS,
  type RelicPool,
  type RelicFilterPool,
} from "@/lib/codex-types";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { DescriptionText } from "./codex-description";
import { RichDescription } from "./rich-description";

function StatBadge({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
      <span className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</span>
      <span className="text-sm font-bold" style={color ? { color } : undefined}>
        {value}
      </span>
    </div>
  );
}

interface RelicDetailProps {
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
  backToListTitle: string;
  relic: CodexRelic;
  poolLabels: Record<RelicPool, string>;
  initialVariant?: RelicPool;
  initialShowBeta?: boolean;
  onClose?: () => void;
  /** Cross-reference entities — when provided, descriptions become rich. */
  entities?: EntityInfo[];
}

// Game order: 아이언클래드, 사일런트, 리젠트, 네크로바인더, 디펙트
const VARIANT_ORDER: RelicPool[] = ["ironclad", "silent", "regent", "necrobinder", "defect"];
export function RelicDetail({ serviceLocale, gameUi, backToListTitle, relic, poolLabels, initialVariant, initialShowBeta = false, onClose, entities }: RelicDetailProps) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  // Don't link the relic to itself in its own description
  const excludeSelf = useMemo(
    () => new Set([relic.name, relic.nameEn]),
    [relic.name, relic.nameEn],
  );

  const variantPools = relic.variantImageUrls
    ? VARIANT_ORDER.filter((p) => relic.variantImageUrls![p])
    : [];
  const [selectedVariant, setSelectedVariant] = useState<RelicPool>(
    initialVariant && relic.variantImageUrls?.[initialVariant] ? initialVariant : variantPools[0] ?? relic.pool,
  );
  const [showBeta, setShowBeta] = useState(initialShowBeta && Boolean(relic.betaImageUrl));

  const displayImageUrl = showBeta && relic.betaImageUrl
    ? relic.betaImageUrl
    : relic.variantImageUrls
    ? relic.variantImageUrls[selectedVariant] ?? null
    : relic.imageUrl;
  const displayOutlinePool = showBeta && relic.betaImageUrl
    ? relic.pool
    : relic.variantImageUrls ? selectedVariant : relic.pool;

  const rarityColor = RELIC_RARITY_COLORS[relic.rarity];
  const poolColor = relic.pool !== "shared" ? getCharacterColor(relic.pool) : undefined;

  return (
    <div className="flex flex-col items-center gap-6 p-4 sm:p-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <Link
          href={localizeHref("/compendium/relics", serviceLocale)}
          className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
          onClick={(e) => {
            if (onClose) {
              e.preventDefault();
              onClose();
            }
          }}
        >
          ← {backToListTitle}
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-gray-400"
            aria-label={serviceText.common.close}
          >
            ✕
          </button>
        )}
      </div>

      {/* Large Relic Image */}
      <div className="w-32 h-32 sm:w-40 sm:h-40 flex items-center justify-center">
        {displayImageUrl ? (
          <Image
            src={displayImageUrl}
            alt={relic.name}
            width={160}
            height={160}
            className="w-full h-full object-contain"
            style={{
              filter: characterOutlineFilter(displayOutlinePool) ?? "drop-shadow(0 4px 8px rgba(0,0,0,0.5))",
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600 text-2xl">
            ?
          </div>
        )}
      </div>

      {/* Character variant tabs */}
      {variantPools.length > 0 && (
        <div className="flex gap-1.5">
          {variantPools.map((pool) => {
            const isSelected = pool === selectedVariant;
            const color = CHARACTER_COLORS[pool] ?? "#888";
            return (
              <button
                key={pool}
                onClick={() => setSelectedVariant(pool)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-all ${
                  isSelected
                    ? "border-current bg-current/15"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
                style={{ color }}
              >
                {poolLabels[pool]}
              </button>
            );
          })}
        </div>
      )}

      {relic.betaImageUrl && (
        <button
          onClick={() => setShowBeta((v) => !v)}
          className={`px-3 py-1 text-xs rounded-lg border transition-all ${
            showBeta
              ? "bg-purple-500/20 text-purple-400 border-purple-500/50"
              : "bg-white/5 text-gray-400 border-white/10 hover:border-white/30"
          }`}
        >
          {serviceText.cardsView.toggles.betaArt}
        </button>
      )}

      {/* Relic Name */}
      <div className="text-center">
        <h1 className="font-game-title text-2xl font-bold text-gray-100">{relic.name}</h1>
        <p className="font-game-text text-sm text-gray-500">{relic.nameEn}</p>
      </div>

      {/* Stats Row */}
      <div className="flex flex-wrap justify-center gap-2">
        <StatBadge
          label={gameUi.common.rarity}
          value={gameUi.relicCollection.rarities[relic.rarity].label}
          color={rarityColor}
        />
        {relic.pool !== "shared" && (
          <StatBadge
            label={serviceText.relicsView.stats.source}
            value={poolLabels[relic.pool as RelicFilterPool] ?? relic.pool}
            color={poolColor}
          />
        )}
        {relic.pool === "shared" && (
          <StatBadge label={serviceText.relicsView.stats.source} value={poolLabels.shared} />
        )}
      </div>

      {/* Description */}
      <div className="w-full bg-white/5 border border-white/10 rounded-lg p-4">
        <div className="text-sm text-gray-200 leading-relaxed">
          {entities ? (
            <RichDescription
              description={relic.description}
              entities={entities}
              excludeEntityTerms={excludeSelf}
            />
          ) : (
            <DescriptionText description={relic.description} />
          )}
        </div>
      </div>

      {/* Flavor text */}
      {relic.flavor && (
        <p className="text-xs text-gray-500 italic text-center max-w-sm">
          {entities ? (
            <RichDescription
              description={relic.flavor}
              entities={entities}
              excludeEntityTerms={excludeSelf}
            />
          ) : (
            <DescriptionText description={relic.flavor} />
          )}
        </p>
      )}

      <div className="w-full bg-white/5 border border-white/10 rounded-lg p-4">
        <h2 className="text-sm font-bold text-gray-300 mb-3">{serviceText.common.comments}</h2>
        <CommentSection threadKey={buildCodexCommentThreadKey("relic", relic.id)} />
      </div>
    </div>
  );
}
