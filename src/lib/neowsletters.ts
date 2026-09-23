import fs from "fs/promises";
import path from "path";

export interface NeowsletterIssue {
  id: string;
  issue: number;
  date: string;
  title: string;
  titleKo: string;
  sourceUrl: string;
  summary: string;
  summaryKo: string;
}

export interface NeowsletterClaim {
  id: string;
  markdown: string;
}

export interface NeowsletterDocument {
  intro: string;
  claims: NeowsletterClaim[];
}

const DATA_PATH = path.join(process.cwd(), "data/sts2-neowsletters.json");
const NOTES_DIR = path.join(process.cwd(), "data/sts2-neowsletters");
const CLAIM_MARKER = /^<!--\s*claim:([a-z0-9-]+)\s*-->$/;

export async function getNeowsletters(): Promise<NeowsletterIssue[]> {
  const raw = JSON.parse(await fs.readFile(DATA_PATH, "utf8")) as NeowsletterIssue[];
  return [...raw].sort((a, b) => b.date.localeCompare(a.date));
}

export async function getNeowsletter(id: string): Promise<NeowsletterIssue | null> {
  const issues = await getNeowsletters();
  return issues.find((issue) => issue.id === id) ?? null;
}

export async function readNeowsletterDocument(
  id: string,
  serviceLocale: "ko" | "en",
): Promise<NeowsletterDocument> {
  const fileName = serviceLocale === "ko" ? `${id}.ko.md` : `${id}.md`;
  const markdown = await fs.readFile(path.join(NOTES_DIR, fileName), "utf8");
  return splitNeowsletterDocument(markdown);
}

export function splitNeowsletterDocument(markdown: string): NeowsletterDocument {
  const claims: NeowsletterClaim[] = [];
  const intro: string[] = [];
  let current: { id: string; lines: string[] } | null = null;

  for (const line of markdown.split("\n")) {
    const marker = line.match(CLAIM_MARKER);
    if (marker) {
      if (current) claims.push({ id: current.id, markdown: current.lines.join("\n").trim() });
      current = { id: marker[1], lines: [] };
      continue;
    }
    if (current) current.lines.push(line);
    else intro.push(line);
  }
  if (current) claims.push({ id: current.id, markdown: current.lines.join("\n").trim() });

  const seen = new Set<string>();
  for (const claim of claims) {
    if (seen.has(claim.id)) throw new Error(`Duplicate Neowsletter claim id: ${claim.id}`);
    seen.add(claim.id);
  }

  return {
    intro: intro.join("\n").trim(),
    claims,
  };
}
