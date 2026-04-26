import { promises as fs } from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import { HistoryCourseShell } from "@/components/history-course/history-course-shell";
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

  return <HistoryCourseShell run={run} />;
}
