import { promises as fs } from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import { HistoryCourseShell } from "@/components/history-course/history-course-shell";
import { collectRelevantCardIds } from "@/components/history-course/topbar-state";
import { getCodexCards } from "@/lib/codex-data";
import type { CodexCard } from "@/lib/codex-types";
import { parseReplayRun } from "@/lib/sts2-run-replay";

type FixtureIndexEntry = {
  slug: string;
  label: string;
  seed: string;
  ascension: number;
  build: string;
  character: string;
};

const FIXTURE_DIR = path.join(process.cwd(), "public", "dev", "run-fixtures");

async function readFixtureIndex(): Promise<FixtureIndexEntry[]> {
  const raw = await fs.readFile(path.join(FIXTURE_DIR, "index.json"), "utf8");
  return JSON.parse(raw) as FixtureIndexEntry[];
}

export async function generateStaticParams() {
  const entries = await readFixtureIndex();
  return entries.map((entry) => ({ seed: entry.seed }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ seed: string }>;
}) {
  const { seed } = await params;
  const entries = await readFixtureIndex();
  const entry = entries.find((e) => e.seed === seed);
  if (!entry) return { title: `도전 이력 — ${seed}` };
  return {
    title: `도전 이력 — ${entry.label}`,
    description: `시드 ${entry.seed} · A${entry.ascension} · ${entry.character}`,
  };
}

function stripCardId(id: string): string {
  return id.includes(".") ? (id.split(".").pop() ?? id) : id;
}

export default async function HistoryCoursePage({
  params,
}: {
  params: Promise<{ seed: string }>;
}) {
  const { seed } = await params;
  const entries = await readFixtureIndex();
  const entry = entries.find((e) => e.seed === seed);
  if (!entry) notFound();

  const fixturePath = path.join(FIXTURE_DIR, `${entry.slug}.json`);
  const fixtureRaw = await fs.readFile(fixturePath, "utf8");
  const run = parseReplayRun(fixtureRaw);

  const allCards = await getCodexCards({ includeDeprecated: true });
  const cardByLookupId = new Map<string, CodexCard>();
  for (const card of allCards) {
    cardByLookupId.set(card.id, card);
  }
  const relevantIds = collectRelevantCardIds(run);
  const cardsById: Record<string, CodexCard> = {};
  for (const replayId of relevantIds) {
    const stripped = stripCardId(replayId);
    const card =
      cardByLookupId.get(replayId) ?? cardByLookupId.get(stripped) ?? null;
    if (card) cardsById[replayId] = card;
  }

  return <HistoryCourseShell run={run} cardsById={cardsById} />;
}
