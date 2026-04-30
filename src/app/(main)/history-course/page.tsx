import { promises as fs } from "node:fs";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RunUploadZone } from "@/components/history-course/run-upload-zone";
import { UploadTutorial } from "@/components/history-course/upload-tutorial";
import { HISTORY_COURSE_ENABLED } from "@/lib/feature-flags";
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

const CHARACTER_META: Record<
  string,
  { ko: string; tone: string; icon: string }
> = {
  "CHARACTER.IRONCLAD": {
    ko: "아이언클래드",
    tone: "text-red-300 ring-red-400/30 from-red-500/10",
    icon: "/images/sts2/icons/ironclad_energy_icon.webp",
  },
  "CHARACTER.SILENT": {
    ko: "사일런트",
    tone: "text-emerald-300 ring-emerald-400/30 from-emerald-500/10",
    icon: "/images/sts2/icons/silent_energy_icon.webp",
  },
  "CHARACTER.DEFECT": {
    ko: "디펙트",
    tone: "text-cyan-300 ring-cyan-400/30 from-cyan-500/10",
    icon: "/images/sts2/icons/defect_energy_icon.webp",
  },
  "CHARACTER.NECROBINDER": {
    ko: "네크로바인더",
    tone: "text-pink-300 ring-pink-400/30 from-pink-500/10",
    icon: "/images/sts2/icons/necrobinder_energy_icon.webp",
  },
  "CHARACTER.REGENT": {
    ko: "리젠트",
    tone: "text-orange-300 ring-orange-400/30 from-orange-500/10",
    icon: "/images/sts2/icons/regent_energy_icon.webp",
  },
};

async function readFixtureIndex(): Promise<FixtureIndexEntry[]> {
  const raw = await fs.readFile(path.join(FIXTURE_DIR, "index.json"), "utf8");
  return JSON.parse(raw) as FixtureIndexEntry[];
}

type EnrichedEntry = FixtureIndexEntry & {
  win: boolean;
  acts: number;
};

async function readAll(): Promise<EnrichedEntry[]> {
  const entries = await readFixtureIndex();
  return Promise.all(
    entries.map(async (entry) => {
      const raw = await fs.readFile(
        path.join(FIXTURE_DIR, `${entry.slug}.json`),
        "utf8",
      );
      const run = parseReplayRun(raw);
      return { ...entry, win: run.win, acts: run.acts.length };
    }),
  );
}

export const metadata = {
  title: "역사 강의서",
  description:
    "슬레이 더 스파이어 2 의 시드 기반 도전 이력. 막 맵 위에 진행 노드를 다시 그려 한 판을 처음부터 끝까지 따라갑니다.",
};

export default async function HistoryCourseIndexPage() {
  if (!HISTORY_COURSE_ENABLED) notFound();
  const entries = await readAll();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="flex items-center gap-4">
        <Image
          src="/images/sts2/relics/history_course.webp"
          alt=""
          width={56}
          height={56}
          className="h-14 w-14 object-contain drop-shadow"
        />
        <div>
          <h1 className="text-3xl font-black tracking-tight text-zinc-50">
            역사 강의서
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-400">
            한 판의 시드와 진행 기록만으로 막 맵을 다시 그려 처음부터 끝까지 따라갑니다.
            내 런 폴더를 올리거나 아래 예시 런 중 하나를 골라보세요.
          </p>
        </div>
      </header>

      <div className="mt-8 space-y-4">
        <RunUploadZone />
        <UploadTutorial />
      </div>

      <header className="mt-12 mb-3">
        <h2 className="text-lg font-bold text-zinc-100">예시 런</h2>
        <p className="text-xs text-zinc-500">
          업로드 전에 시연을 원하신다면 아래에서 골라보세요.
        </p>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((entry) => {
          const meta = CHARACTER_META[entry.character] ?? {
            ko: entry.character,
            tone: "text-zinc-300 ring-zinc-700 from-zinc-800/40",
            icon: "/images/sts2/icons/star_icon.webp",
          };
          return (
            <li key={entry.seed}>
              <Link
                href={`/history-course/${entry.seed}`}
                prefetch={false}
                className={`group block rounded-xl bg-gradient-to-br to-zinc-950/40 p-4 ring-1 ring-inset transition hover:-translate-y-0.5 hover:ring-amber-300/40 ${meta.tone}`}
              >
                <div className="flex items-start gap-3">
                  <Image
                    src={meta.icon}
                    alt=""
                    width={36}
                    height={36}
                    className="h-9 w-9 object-contain"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-xs font-bold ${meta.tone.split(" ")[0]}`}>
                        {meta.ko}
                      </span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                          entry.win
                            ? "bg-amber-500/15 text-amber-200"
                            : "bg-zinc-800/70 text-zinc-400"
                        }`}
                      >
                        {entry.win ? "정상" : "도중 사망"}
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm font-medium text-zinc-100 group-hover:text-white">
                      {entry.label}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-400">
                      <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-zinc-300">
                        {entry.seed}
                      </code>
                      <span>승천 {entry.ascension}</span>
                      <span className="text-zinc-600">·</span>
                      <span>{entry.build}</span>
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
