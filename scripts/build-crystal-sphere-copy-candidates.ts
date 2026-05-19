import fs from "fs/promises";
import path from "path";

type SourceTable = "events" | "game_over_screen" | "card_reward_ui" | "combat_messages";

interface Candidate {
  id: string;
  status: "candidate" | "include" | "exclude" | "needs-edit";
  category: string;
  sourceTable: SourceTable;
  sourceKey: string;
  sourceTextKo: string;
  sourceTextEn: string;
  suggestedUse: string;
  curatorNote: string;
}

interface CandidateInventory {
  candidates?: Candidate[];
}

const ROOT = process.cwd();
const LOCALIZATION_DIR = path.join(ROOT, "data/sts2/localization");
const OUT_PATH = path.join(ROOT, "data/i18n/crystal-sphere-copy-candidates.json");

const SOURCE_TABLES = [
  "events",
  "game_over_screen",
  "card_reward_ui",
  "combat_messages",
] as const satisfies readonly SourceTable[];

const CATEGORY_ORDER = [
  "crystal-sphere",
  "failure",
  "game-over",
  "card-reward",
  "combat",
  "event-line",
  "event-option",
  "event-title",
  "event-text",
];

function candidateId(sourceTable: SourceTable, sourceKey: string): string {
  return `crystalSphere.${sourceTable}.${sourceKey}`
    .replace(/[^A-Za-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

function categoryFor(sourceTable: SourceTable, sourceKey: string): string {
  if (sourceTable === "events" && sourceKey.startsWith("CRYSTAL_SPHERE.")) {
    return "crystal-sphere";
  }
  if (sourceTable === "events" && sourceKey.endsWith(".loss")) {
    return "failure";
  }
  if (sourceTable === "events" && sourceKey.includes(".options.")) {
    return "event-option";
  }
  if (sourceTable === "events" && sourceKey.endsWith(".description")) {
    return "event-line";
  }
  if (sourceTable === "events" && sourceKey.endsWith(".title")) {
    return "event-title";
  }
  if (sourceTable === "game_over_screen") {
    return "game-over";
  }
  if (sourceTable === "card_reward_ui") {
    return "card-reward";
  }
  if (sourceTable === "combat_messages") {
    return "combat";
  }
  return "event-text";
}

function suggestedUseFor(category: string): string {
  switch (category) {
    case "crystal-sphere":
      return "수정구 세션 시작, 공개, 종료 문구";
    case "failure":
    case "game-over":
      return "위험 슬롯, 저주/상태이상, 실패형 점괘";
    case "event-option":
      return "선택지형 점괘, 분할 납부 확장";
    case "event-line":
      return "점괘 본문, 결과 소제목, 공유 문구";
    case "event-title":
      return "결과 카드의 짧은 소제목";
    case "card-reward":
      return "카드 보상 판단, 다시 뽑기 계열 UI";
    case "combat":
      return "전투 결과형 짧은 반응 문구";
    default:
      return "검토 후 용도 지정";
  }
}

async function readTable(locale: "kor" | "eng", table: SourceTable): Promise<Record<string, string>> {
  const raw = await fs.readFile(path.join(LOCALIZATION_DIR, locale, `${table}.json`), "utf-8");
  return JSON.parse(raw) as Record<string, string>;
}

async function readExistingCandidates(): Promise<Map<string, Candidate>> {
  try {
    const raw = await fs.readFile(OUT_PATH, "utf-8");
    const inventory = JSON.parse(raw) as CandidateInventory;
    return new Map((inventory.candidates ?? []).map((candidate) => [candidate.id, candidate]));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return new Map();
    }
    throw error;
  }
}

async function buildCandidates(): Promise<Candidate[]> {
  const candidates: Candidate[] = [];
  const existingCandidates = await readExistingCandidates();

  for (const sourceTable of SOURCE_TABLES) {
    const [koTable, enTable] = await Promise.all([
      readTable("kor", sourceTable),
      readTable("eng", sourceTable),
    ]);

    for (const sourceKey of Object.keys(koTable).sort()) {
      const sourceTextKo = koTable[sourceKey];
      if (typeof sourceTextKo !== "string" || sourceTextKo.trim() === "") continue;
      const sourceTextEn = typeof enTable[sourceKey] === "string" ? enTable[sourceKey] : "";
      const category = categoryFor(sourceTable, sourceKey);

      candidates.push({
        id: candidateId(sourceTable, sourceKey),
        status: existingCandidates.get(candidateId(sourceTable, sourceKey))?.status ?? "candidate",
        category,
        sourceTable,
        sourceKey,
        sourceTextKo,
        sourceTextEn,
        suggestedUse: suggestedUseFor(category),
        curatorNote: existingCandidates.get(candidateId(sourceTable, sourceKey))?.curatorNote ?? "",
      });
    }
  }

  return candidates.sort((a, b) => {
    const categoryDelta = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    if (categoryDelta !== 0) return categoryDelta;
    const tableDelta = SOURCE_TABLES.indexOf(a.sourceTable) - SOURCE_TABLES.indexOf(b.sourceTable);
    if (tableDelta !== 0) return tableDelta;
    return a.sourceKey.localeCompare(b.sourceKey);
  });
}

async function main() {
  const candidates = await buildCandidates();
  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(
    OUT_PATH,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        description: "Candidate game localization lines for Crystal Sphere borrowed-copy curation.",
        statuses: ["candidate", "include", "exclude", "needs-edit"],
        sourceLocales: ["kor", "eng"],
        sourceTables: SOURCE_TABLES,
        candidates,
      },
      null,
      2,
    )}\n`,
    "utf-8",
  );
  console.log(`Wrote ${candidates.length} candidates to ${path.relative(ROOT, OUT_PATH)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
