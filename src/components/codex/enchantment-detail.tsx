"use client";

import { useMemo } from "react";
import Image from "@/components/ui/static-image";
import Link from "next/link";
import { CommentSection } from "@/components/comment-section";
import { buildCodexCommentThreadKey } from "@/lib/comment-threads";
import type { ServiceLocale } from "@/lib/i18n";
import type { EntityVersionDiff, STS2Change, STS2Patch } from "@/lib/types";
import { localizeHref } from "@/lib/i18n";
import { getCodexServiceMessages } from "@/lib/codex-service";
import {
  CodexEnchantment,
  CodexRelic,
  ENCHANTMENT_CARD_TYPE_CONFIG,
  type EnchantmentCardTypeFilter,
} from "@/lib/codex-types";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { DescriptionText } from "./codex-description";
import { RichDescription } from "./rich-description";
import { RelicTile } from "./relic-tile";
import { STS2ChangeHistory } from "./sts2-change-history";

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

interface EnchantmentDetailProps {
  serviceLocale: ServiceLocale;
  enchantment: CodexEnchantment;
  onClose?: () => void;
  /** Cross-reference entities — when provided, descriptions become rich. */
  entities?: EntityInfo[];
  /** All relics, used to surface ones that grant this enchantment. */
  relics?: CodexRelic[];
  patches?: STS2Patch[];
  changes?: STS2Change[];
  versionDiffs?: EntityVersionDiff[];
}

/**
 * Decide whether a relic grants this enchantment by scanning its description
 * for the enchantment's KO or EN name. SSOT lives in the game's relic effects,
 * but the description is the closest thing to a public contract for now.
 */
function relicMentionsEnchantment(relic: CodexRelic, ench: CodexEnchantment): boolean {
  const desc = `${relic.description ?? ""} ${relic.descriptionRaw ?? ""}`;
  if (ench.name && desc.includes(ench.name)) return true;
  if (ench.nameEn && desc.toLowerCase().includes(ench.nameEn.toLowerCase())) return true;
  return false;
}

function getEnchantmentDetailLabels(serviceLocale: ServiceLocale) {
  return serviceLocale === "ko"
    ? {
        patchHistory: "패치 이력",
        noPatchHistory: "구조화 변경 없음",
      }
    : {
        patchHistory: "Patch History",
        noPatchHistory: "No structured changes",
      };
}

export function EnchantmentDetail({ serviceLocale, enchantment, onClose, entities, relics, patches, changes, versionDiffs }: EnchantmentDetailProps) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const detailLabels = getEnchantmentDetailLabels(serviceLocale);
  const cardTypeFilter: EnchantmentCardTypeFilter = enchantment.cardType ?? "Any";
  const cardTypeConfig = ENCHANTMENT_CARD_TYPE_CONFIG[cardTypeFilter];

  const grantingRelics = useMemo(() => {
    if (!relics) return [];
    return relics
      .filter((r) => relicMentionsEnchantment(r, enchantment))
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [relics, enchantment]);

  const excludeSelf = useMemo(
    () => new Set([enchantment.name, enchantment.nameEn]),
    [enchantment.name, enchantment.nameEn],
  );

  return (
    <div className="flex flex-col items-center gap-6 p-4 sm:p-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <Link
          href={localizeHref("/compendium/enchantments", serviceLocale)}
          className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
          onClick={(e) => {
            if (onClose) {
              e.preventDefault();
              onClose();
            }
          }}
        >
          ← {serviceText.enchantmentsView.backToList}
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

      {/* Large Enchantment Image */}
      <div className="w-28 h-28 sm:w-36 sm:h-36 flex items-center justify-center">
        {enchantment.imageUrl ? (
          <Image
            src={enchantment.imageUrl}
            alt={enchantment.name}
            width={144}
            height={144}
            className="w-full h-full object-contain drop-shadow-lg"
          />
        ) : (
          <div className="w-full h-full rounded-lg bg-white/5 flex items-center justify-center text-gray-600 text-2xl">
            ?
          </div>
        )}
      </div>

      {/* Enchantment Name */}
      <div className="text-center">
        <h1 className="font-game-title text-2xl font-bold text-gray-100">{enchantment.name}</h1>
        <p className="font-game-text text-sm text-gray-500">{enchantment.nameEn}</p>
      </div>

      {/* Stats Row */}
      <div className="flex flex-wrap justify-center gap-2">
        <StatBadge
          label={serviceText.enchantmentsView.cardTypeFilter}
          value={serviceText.labels.enchantmentCardTypes[cardTypeFilter].label}
          color={cardTypeConfig.color}
        />
        {enchantment.isStackable && (
          <StatBadge label={serviceText.enchantmentsView.stackable} value={serviceText.enchantmentsView.possible} color="#f59e0b" />
        )}
      </div>

      {/* Description */}
      <div className="w-full bg-white/5 border border-white/10 rounded-lg p-4">
        <div className="text-sm text-gray-200 leading-relaxed">
          {entities ? (
            <RichDescription
              description={enchantment.description}
              entities={entities}
              excludeEntityTerms={excludeSelf}
            />
          ) : (
            <DescriptionText description={enchantment.description} />
          )}
        </div>
      </div>

      {/* Extra card text */}
      {enchantment.extraCardText && (
        <div className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-4 py-3">
          <span className="block text-xs font-medium text-gray-500 mb-1">
            {serviceText.enchantmentsView.cardText}
          </span>
          <div className="text-sm text-zinc-300 leading-relaxed">
            {entities ? (
              <RichDescription
                description={enchantment.extraCardText}
                entities={entities}
                excludeEntityTerms={excludeSelf}
              />
            ) : (
              <DescriptionText description={enchantment.extraCardText} />
            )}
          </div>
        </div>
      )}

      {/* Granting relics — relics whose effect mentions this enchantment */}
      {grantingRelics.length > 0 && (
        <div className="w-full bg-white/5 border border-white/10 rounded-lg p-4">
          <h2 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">
            {serviceText.enchantmentsView.grantingRelics}
          </h2>
          <div className="flex flex-wrap gap-2">
            {grantingRelics.map((r) => (
              <Link
                key={r.id}
                href={`/compendium/relics?relic=${r.id.toLowerCase()}`}
                className="block"
                onClick={(e) => {
                  // If we're inside the enchantment detail modal, the parent
                  // controls navigation — let the link work as a hard nav.
                  // Otherwise (standalone page) Link handles it.
                  void e;
                }}
              >
                <RelicTile serviceLocale={serviceLocale} relic={r} />
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="w-full rounded-lg border border-white/10 bg-black/20 p-4">
        <h2 className="mb-3 font-game-title text-sm font-bold text-gray-300">{detailLabels.patchHistory}</h2>
        <STS2ChangeHistory
          serviceLocale={serviceLocale}
          entityType="enchantment"
          entityId={enchantment.id}
          changes={changes}
          versionDiffs={versionDiffs}
          patches={patches}
          emptyLabel={detailLabels.noPatchHistory}
        />
      </div>

      <div className="w-full bg-white/5 border border-white/10 rounded-lg p-4">
        <h2 className="text-sm font-bold text-gray-300 mb-3">{serviceText.common.comments}</h2>
        <CommentSection threadKey={buildCodexCommentThreadKey("enchantment", enchantment.id)} />
      </div>
    </div>
  );
}
