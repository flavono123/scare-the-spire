"use client";

import { type ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import { CommentSection } from "@/components/comment-section";
import { STS2ChangeHistory } from "@/components/codex/sts2-change-history";
import { buildCodexCommentThreadKey } from "@/lib/comment-threads";
import { getCodexServiceMessages } from "@/lib/codex-service";
import { localizeHref, type ServiceLocale } from "@/lib/i18n";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import type { CodexAscension } from "@/lib/codex-types";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { AscensionToken } from "./ascension-token";
import { DescriptionText } from "./codex-description";
import { GameHoverTip } from "./hover-tip";
import { RichDescription } from "./rich-description";

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
      className="group rounded-lg border border-border bg-card/80 px-4 py-3"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-game-title text-sm font-bold text-foreground">
        <span>{title}</span>
        <span className="text-xs text-gray-500 transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function detailLabels(serviceLocale: ServiceLocale) {
  return serviceLocale === "ko"
    ? {
        englishName: "영어명",
        patchHistory: "패치 이력",
        noPatchHistory: "구조화 변경 없음",
        level: "승천 {level}",
      }
    : {
        englishName: "English name",
        patchHistory: "Patch History",
        noPatchHistory: "No structured changes",
        level: "Ascension {level}",
      };
}

export function AscensionInspect({
  ascension,
  entities,
}: {
  ascension: CodexAscension;
  entities?: EntityInfo[];
}) {
  const excludeSelf = useMemo(
    () => new Set([ascension.name, ascension.nameEn, ...ascension.aliasesKo, ...ascension.aliasesEn]),
    [ascension.aliasesEn, ascension.aliasesKo, ascension.name, ascension.nameEn],
  );

  return (
    <div className="flex w-full max-w-[32rem] items-center gap-3 sm:gap-5">
      <AscensionToken level={ascension.level} size={96} />
      <GameHoverTip title={ascension.name} className="min-w-0 w-full" style={{ minWidth: 0 }}>
        {entities ? (
          <RichDescription
            description={ascension.description}
            entities={entities}
            excludeEntityTerms={excludeSelf}
            className="block text-left"
          />
        ) : (
          <DescriptionText description={ascension.description} className="block text-left" />
        )}
      </GameHoverTip>
    </div>
  );
}

export function AscensionDetail({
  serviceLocale,
  gameUi,
  backToListTitle,
  ascension,
  entities,
  onClose,
}: {
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
  backToListTitle?: string;
  ascension: CodexAscension;
  entities?: EntityInfo[];
  onClose?: () => void;
}) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const labels = detailLabels(serviceLocale);
  const [commentCount, setCommentCount] = useState(0);
  const backTitle = backToListTitle ?? gameUi.nav.ascensions;

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6" data-ascension-detail>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href={localizeHref("/compendium/ascensions", serviceLocale)}
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
            type="button"
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
          <AscensionInspect ascension={ascension} entities={entities} />
        </section>

        <aside className="flex flex-col gap-3">
          <section className="rounded-lg border border-border bg-card/80 px-4 py-3">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 font-game-text text-sm font-bold text-gray-300">
                  {labels.level.replace("{level}", String(ascension.level))}
                </span>
              </div>
              {ascension.nameEn !== ascension.name && (
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">{labels.englishName}</div>
                  <div className="font-game-text text-sm text-foreground">{ascension.nameEn}</div>
                </div>
              )}
            </div>
          </section>

          <InfoRailSection title={labels.patchHistory}>
            <STS2ChangeHistory
              serviceLocale={serviceLocale}
              entityType="ascension"
              entityId={ascension.id}
              emptyLabel={labels.noPatchHistory}
            />
          </InfoRailSection>

          <InfoRailSection title={`${serviceText.common.comments}${commentCount > 0 ? ` (${commentCount})` : ""}`}>
            <CommentSection
              threadKey={buildCodexCommentThreadKey("ascension", ascension.id)}
              onCountChange={setCommentCount}
            />
          </InfoRailSection>
        </aside>
      </div>
    </div>
  );
}
