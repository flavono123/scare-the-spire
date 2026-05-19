"use client";

import Image from "@/components/ui/static-image";
import type { ReactNode } from "react";
import { localizeHref, type ServiceLocale } from "@/lib/i18n";
import { EntityPreview, type EntityInfo } from "@/components/patch-note-renderer";

type CodexReferenceKind = "card" | "event" | "potion" | "relic";

export interface CodexReferenceTarget {
  id: string;
  href: string;
  title: string;
  entity?: EntityInfo;
}

interface EntityReferenceLinksProps {
  children?: ReactNode;
  kind: CodexReferenceKind;
  serviceLocale: ServiceLocale;
  targets: readonly CodexReferenceTarget[];
}

const REFERENCE_KIND_CONFIG: Record<CodexReferenceKind, { icon: string; label: string }> = {
  card: {
    icon: "/images/sts2/nav/stats_cards.png",
    label: "관련 카드",
  },
  event: {
    icon: "/images/sts2/nav/question_mark.png",
    label: "관련 이벤트",
  },
  potion: {
    icon: "/images/sts2/potions/potion_shaped_rock.webp",
    label: "관련 포션",
  },
  relic: {
    icon: "/images/sts2/relics/bing_bong.webp",
    label: "관련 유물",
  },
};

export function EntityReferenceLinks({
  children,
  kind,
  serviceLocale,
  targets,
}: EntityReferenceLinksProps) {
  if (targets.length === 0) return null;
  const config = REFERENCE_KIND_CONFIG[kind];

  return (
    <section className="w-full rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <div className="mb-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm font-bold text-gray-300">
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
      {children}
    </section>
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
