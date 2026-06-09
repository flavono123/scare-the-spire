"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DonationPanel } from "@/components/history-course/donation-panel";
import { HistoryCourseShell } from "@/components/history-course/history-course-shell";
import { collectRelevantCardIds } from "@/components/history-course/topbar-state";
import type { CodexCard, CodexRelic } from "@/lib/codex-types";
import { getDonatedRun } from "@/lib/run-donation";
import { loadRun, saveRun } from "@/lib/run-store";
import { parseRunRouteSlug } from "@/lib/sts2-run-hash";
import { parseReplayRun, type ReplayRun } from "@/lib/sts2-run-replay";
import {
  getMadSciencePreviewCard,
  getMadScienceVariantId,
  getMadScienceVariantPartsFromId,
  TINKER_RIDER_CHOICE_LABELS,
  TINKER_RIDER_CHOICE_LABELS_EN,
} from "@/lib/tinker-time";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { serviceMessages } from "@/messages/service";

interface Props {
  runId: string;
  allCards: CodexCard[];
  allRelics: CodexRelic[];
}

type Source = "local" | "donated";
type Status = "loading" | "ok" | "missing" | "invalid";

function stripCardId(id: string): string {
  return id.includes(".") ? (id.split(".").pop() ?? id) : id;
}

function buildRunMadScienceCard(
  replayId: string,
  cardByLookupId: Map<string, CodexCard>,
): CodexCard | null {
  const stripped = stripCardId(replayId);
  const parts = getMadScienceVariantPartsFromId(stripped);
  if (!parts?.riderId) return null;

  const baseId = getMadScienceVariantId(parts.cardType);
  const baseCard = cardByLookupId.get(baseId);
  if (!baseCard) return null;

  const riderLabel =
    baseCard.madScienceLabels?.riderChoiceLabels[parts.riderId] ??
    TINKER_RIDER_CHOICE_LABELS[parts.riderId];
  const riderLabelEn = TINKER_RIDER_CHOICE_LABELS_EN[parts.riderId];
  return {
    ...getMadSciencePreviewCard(
      baseCard,
      parts.cardType,
      parts.riderId,
      baseCard.typeLabel,
    ),
    id: stripped,
    name: `${baseCard.name} · ${riderLabel}`,
    nameEn: `${baseCard.nameEn} · ${riderLabelEn}`,
    madScienceLabels: baseCard.madScienceLabels,
  };
}

export function RunDetailLoader({ runId, allCards, allRelics }: Props) {
  const copy = serviceMessages[useServiceLocale()].historyCourse.detail;
  const [run, setRun] = useState<ReplayRun | null>(null);
  const [raw, setRaw] = useState<string | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (!parseRunRouteSlug(runId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus("invalid");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // 1) Local stash first — fast, offline-capable, primary path.
        const stored = await loadRun(runId);
        if (cancelled) return;
        if (stored) {
          const parsed = parseReplayRun(stored.raw);
          if (cancelled) return;
          setRun(parsed);
          setRaw(stored.raw);
          setSource("local");
          setStatus("ok");
          return;
        }
        // 2) Public donation as a fallback so shared URLs work
        // across browsers/devices.
        const donated = await getDonatedRun(runId);
        if (cancelled) return;
        if (donated) {
          const parsed = parseReplayRun(donated.raw);
          if (cancelled) return;
          // Cache to local IDB so subsequent visits are offline.
          // Tag as donation-cache so the landing's "내 런" list does
          // NOT pick this up — it isn't the visitor's run.
          void saveRun({
            runId,
            raw: donated.raw,
            origin: "donation-cache",
          }).catch(() => {});
          setRun(parsed);
          setRaw(donated.raw);
          setSource("donated");
          setStatus("ok");
          return;
        }
        setStatus("missing");
      } catch (err) {
        console.error("[history-course] load failed", err);
        if (!cancelled) setStatus("missing");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  if (status === "invalid") {
    return (
      <EmptyState
        title={copy.invalidTitle}
        message={copy.invalidMessage}
        backLabel={copy.backToIndex}
      />
    );
  }

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center text-sm text-zinc-500">
        {copy.loading}
      </div>
    );
  }

  if (status === "missing" || !run) {
    return (
      <EmptyState
        title={copy.missingTitle}
        message={copy.missingMessage}
        backLabel={copy.backToIndex}
      />
    );
  }

  const cardByLookupId = new Map<string, CodexCard>();
  for (const card of allCards) {
    cardByLookupId.set(card.id, card);
  }
  const relevantIds = collectRelevantCardIds(run);
  const cardsById: Record<string, CodexCard> = {};
  for (const replayId of relevantIds) {
    const stripped = stripCardId(replayId);
    const card =
      cardByLookupId.get(replayId) ??
      cardByLookupId.get(stripped) ??
      buildRunMadScienceCard(replayId, cardByLookupId);
    if (card) cardsById[replayId] = card;
  }

  // Replay ids carry the `RELIC.` prefix, but codex relic ids don't.
  // Index both shapes so lookups by either form succeed.
  const relicsById: Record<string, CodexRelic> = {};
  for (const relic of allRelics) {
    relicsById[relic.id] = relic;
    relicsById[`RELIC.${relic.id}`] = relic;
  }

  return (
    <>
      {source && raw && (
        <DonationPanel runId={runId} run={run} raw={raw} source={source} />
      )}
      <HistoryCourseShell
        run={run}
        cardsById={cardsById}
        relicsById={relicsById}
      />
    </>
  );
}

function EmptyState({
  title,
  message,
  backLabel,
}: {
  title: string;
  message: string;
  backLabel: string;
}) {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-xl font-bold text-zinc-200">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{message}</p>
      <Link
        href="/history-course"
        className="mt-6 inline-block rounded-md bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-100 ring-1 ring-zinc-700 hover:bg-zinc-700"
      >
        {backLabel}
      </Link>
    </div>
  );
}
