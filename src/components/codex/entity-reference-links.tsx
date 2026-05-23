"use client";

import Image from "@/components/ui/static-image";
import type { ReactNode } from "react";
import { localizeHref, type ServiceLocale } from "@/lib/i18n";
import { EntityPreview, type EntityInfo } from "@/components/patch-note-renderer";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";

export type CodexReferenceKind = "card" | "event" | "potion" | "relic" | "enchantment" | "affliction" | "monster" | "encounter" | "ancient" | "power" | "epoch";

export interface CodexReferenceTarget {
  id: string;
  href: string;
  title: string;
  entity?: EntityInfo;
}

interface EntityReferenceLinksProps {
  children?: ReactNode;
  gameUi?: CodexGameUiLabels;
  kind: CodexReferenceKind;
  serviceLocale: ServiceLocale;
  targets: readonly CodexReferenceTarget[];
}

export interface CodexReferenceGroup {
  kind: CodexReferenceKind;
  targets: readonly CodexReferenceTarget[];
}

interface EntityReferenceGroupLinksProps {
  children?: ReactNode;
  gameUi?: CodexGameUiLabels;
  groups: readonly CodexReferenceGroup[];
  serviceLocale: ServiceLocale;
}

const REFERENCE_KIND_CONFIG: Record<CodexReferenceKind, { icon: string; fallbackLabel: Record<ServiceLocale, string> }> = {
  card: {
    icon: "/images/sts2/nav/stats_cards.png",
    fallbackLabel: { ko: "카드", en: "Card" },
  },
  event: {
    icon: "/images/sts2/nav/question_mark.png",
    fallbackLabel: { ko: "이벤트", en: "Event" },
  },
  potion: {
    icon: "/images/sts2/potions/potion_shaped_rock.webp",
    fallbackLabel: { ko: "포션", en: "Potion" },
  },
  relic: {
    icon: "/images/sts2/relics/bing_bong.webp",
    fallbackLabel: { ko: "유물", en: "Relic" },
  },
  enchantment: {
    icon: "/images/sts2/enchantments/swift.webp",
    fallbackLabel: { ko: "인챈트", en: "Enchantment" },
  },
  affliction: {
    icon: "/images/sts2/powers/chains_of_binding_power.webp",
    fallbackLabel: { ko: "고난", en: "Affliction" },
  },
  monster: {
    icon: "/images/sts2/nav/stats_monsters.png",
    fallbackLabel: { ko: "몬스터", en: "Monster" },
  },
  encounter: {
    icon: "/images/sts2/run-history/monster.png",
    fallbackLabel: { ko: "전투", en: "Encounter" },
  },
  ancient: {
    icon: "/images/sts2/nav/stats_ancients.png",
    fallbackLabel: { ko: "고대의 존재", en: "Ancient" },
  },
  power: {
    icon: "/images/sts2/nav/unmovable_power_beta.webp",
    fallbackLabel: { ko: "파워", en: "Power" },
  },
  epoch: {
    icon: "/images/sts2/relics/history_course.webp",
    fallbackLabel: { ko: "역사", en: "Epoch" },
  },
};

const COLLECTION_SUFFIX_PATTERN = /\s*(목록|모음집|연구실|도감|Library|Collection|Lab|Codex|Bestiary)$/i;

function compactCollectionLabel(label: string): string {
  return label.replace(COLLECTION_SUFFIX_PATTERN, "").trim() || label;
}

function relatedResourceLabel(
  kind: CodexReferenceKind,
  serviceLocale: ServiceLocale,
  gameUi?: CodexGameUiLabels,
): string {
  const fallback = REFERENCE_KIND_CONFIG[kind].fallbackLabel[serviceLocale];
  const resourceLabel = (() => {
    if (!gameUi) return fallback;
    switch (kind) {
      case "card":
        return compactCollectionLabel(gameUi.cardLibraryTitle);
      case "relic":
        return compactCollectionLabel(gameUi.relicCollectionTitle);
      case "potion":
        return compactCollectionLabel(gameUi.potionLabTitle);
      case "power":
        return gameUi.nav.powers;
      case "monster":
        return compactCollectionLabel(gameUi.bestiaryTitle);
      case "event":
        return gameUi.eventsTitle;
      case "ancient":
        return gameUi.ancientsTitle;
      case "epoch":
        return gameUi.epochsTitle;
      case "encounter":
      case "enchantment":
      case "affliction":
        return fallback;
    }
  })();
  return serviceLocale === "ko" ? `관련 ${resourceLabel}` : `Related ${resourceLabel}`;
}

export function EntityReferenceLinks({
  children,
  gameUi,
  kind,
  serviceLocale,
  targets,
}: EntityReferenceLinksProps) {
  if (targets.length === 0) return null;
  const config = {
    icon: REFERENCE_KIND_CONFIG[kind].icon,
    label: relatedResourceLabel(kind, serviceLocale, gameUi),
  };

  return (
    <section className="w-full rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <ReferenceLine
        config={config}
        kind={kind}
        serviceLocale={serviceLocale}
        targets={targets}
        withBottomMargin={Boolean(children)}
      />
      {children}
    </section>
  );
}

export function EntityReferenceGroupLinks({
  children,
  gameUi,
  groups,
  serviceLocale,
}: EntityReferenceGroupLinksProps) {
  const visibleGroups = groups.filter((group) => group.targets.length > 0);
  if (visibleGroups.length === 0) return null;

  return (
    <section className="w-full rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <div className="space-y-2.5">
        {visibleGroups.map((group) => (
          <ReferenceLine
            key={group.kind}
            config={{
              icon: REFERENCE_KIND_CONFIG[group.kind].icon,
              label: relatedResourceLabel(group.kind, serviceLocale, gameUi),
            }}
            kind={group.kind}
            serviceLocale={serviceLocale}
            targets={group.targets}
          />
        ))}
      </div>
      {children}
    </section>
  );
}

function ReferenceLine({
  config,
  kind,
  serviceLocale,
  targets,
  withBottomMargin = false,
}: {
  config: { icon: string; label: string };
  kind: CodexReferenceKind;
  serviceLocale: ServiceLocale;
  targets: readonly CodexReferenceTarget[];
  withBottomMargin?: boolean;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm font-bold text-gray-300 ${withBottomMargin ? "mb-3" : ""}`}>
      <Image
        src={config.icon}
        alt=""
        width={22}
        height={22}
        className="h-5 w-5 object-contain"
      />
      <span>{config.label}:</span>
      {targets.map((target, index) => (
        <span key={target.id} className="inline-flex items-center gap-1">
          {index > 0 ? <span className="text-gray-500">,</span> : null}
          <EntityPreview
            entity={toPreviewEntity(target, kind, serviceLocale)}
            preferEntityLocaleLabel={false}
          >
            {target.title}
          </EntityPreview>
        </span>
      ))}
    </div>
  );
}

function toPreviewEntity(
  target: CodexReferenceTarget,
  kind: CodexReferenceKind,
  serviceLocale: ServiceLocale,
): EntityInfo {
  const href = localizeHref(target.href, serviceLocale);
  return {
    ...target.entity,
    id: target.entity?.id ?? target.id,
    nameEn: target.entity?.nameEn ?? target.title,
    nameKo: target.entity?.nameKo ?? target.title,
    imageUrl: target.entity?.imageUrl ?? null,
    href,
    color: target.entity?.color ?? kind,
    type: target.entity?.type ?? kind,
  };
}
