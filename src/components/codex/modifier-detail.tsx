"use client";

import { type ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import { CommentSection } from "@/components/comment-section";
import { STS2ChangeHistory } from "@/components/codex/sts2-change-history";
import { buildCodexCommentThreadKey } from "@/lib/comment-threads";
import { getCodexServiceMessages } from "@/lib/codex-service";
import { localizeHref, type ServiceLocale } from "@/lib/i18n";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import type { CodexModifier } from "@/lib/codex-types";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { DescriptionText } from "./codex-description";
import { GameHoverTip } from "./hover-tip";
import { ModifierToken } from "./modifier-token";
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
      className="group rounded-lg border border-border bg-black/20 px-4 py-3"
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
        positive: "긍정",
        negative: "부정",
      }
    : {
        englishName: "English name",
        patchHistory: "Patch History",
        noPatchHistory: "No structured changes",
        positive: "Positive",
        negative: "Negative",
      };
}

export function ModifierInspect({
  modifier,
  entities,
}: {
  modifier: CodexModifier;
  entities?: EntityInfo[];
}) {
  const excludeSelf = useMemo(
    () => new Set([modifier.name, modifier.nameEn]),
    [modifier.name, modifier.nameEn],
  );

  return (
    <div className="flex w-full max-w-[32rem] items-center gap-3 sm:gap-5">
      <ModifierToken modifier={modifier} size={96} />
      <GameHoverTip title={modifier.name} className="min-w-0 w-full" style={{ minWidth: 0 }}>
        {entities ? (
          <RichDescription
            description={modifier.description}
            entities={entities}
            excludeEntityTerms={excludeSelf}
            className="block text-left"
          />
        ) : (
          <DescriptionText description={modifier.description} className="block text-left" />
        )}
      </GameHoverTip>
    </div>
  );
}

export function ModifierDetail({
  serviceLocale,
  gameUi,
  backToListTitle,
  modifier,
  entities,
  onClose,
}: {
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
  backToListTitle?: string;
  modifier: CodexModifier;
  entities?: EntityInfo[];
  onClose?: () => void;
}) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const labels = detailLabels(serviceLocale);
  const [commentCount, setCommentCount] = useState(0);
  const polarityLabel = modifier.polarity === "good" ? labels.positive : labels.negative;
  const polarityColor = modifier.polarity === "good" ? "#7fff00" : "#ff5555";
  const backTitle = backToListTitle ?? gameUi.nav.modifiers;

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6" data-modifier-detail>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href={localizeHref("/compendium/modifiers", serviceLocale)}
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
          <ModifierInspect modifier={modifier} entities={entities} />
        </section>

        <aside className="flex flex-col gap-3">
          <section className="rounded-lg border border-border bg-black/20 px-4 py-3">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <span
                  className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 font-game-text text-sm font-bold"
                  style={{ color: polarityColor }}
                >
                  {polarityLabel}
                </span>
              </div>
              {modifier.nameEn !== modifier.name && (
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">{labels.englishName}</div>
                  <div className="font-game-text text-sm text-foreground">{modifier.nameEn}</div>
                </div>
              )}
            </div>
          </section>

          <InfoRailSection title={labels.patchHistory}>
            <STS2ChangeHistory
              serviceLocale={serviceLocale}
              entityType="modifier"
              entityId={modifier.id}
              emptyLabel={labels.noPatchHistory}
            />
          </InfoRailSection>

          <InfoRailSection title={`${serviceText.common.comments}${commentCount > 0 ? ` (${commentCount})` : ""}`}>
            <CommentSection
              threadKey={buildCodexCommentThreadKey("modifier", modifier.id)}
              onCountChange={setCommentCount}
            />
          </InfoRailSection>
        </aside>
      </div>
    </div>
  );
}
