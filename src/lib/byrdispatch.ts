import fs from "fs/promises";
import path from "path";
import {
  BYRDISPATCH_ICON,
  BYRDISPATCH_NOTICE_ICON,
  type ByrdispatchNotice,
} from "@/lib/byrdispatch-static";

export { BYRDISPATCH_ICON, BYRDISPATCH_NOTICE_ICON, type ByrdispatchNotice };

const BYRDISPATCH_DIR = path.join(process.cwd(), "data/byrdispatch");
const BYRDISPATCH_FILE_RE = /^\d{4}-\d{2}-\d{2}\.md$/;
const BYRDISPATCH_NOTICE_SECTION = "공지";
const BYRDISPATCH_STATUS_RE = /\s*\((new|개발 중|버그)\)\s*$/;
const BYRDISPATCH_MARKDOWN_LINK_RE = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g;

export type ByrdispatchStatus = "new" | "wip" | "bug";

export type ByrdispatchBullet = {
  text: string;
  statuses: ByrdispatchStatus[];
};

export type ByrdispatchSection = {
  title: string;
  level: 2 | 3;
  bullets: ByrdispatchBullet[];
  isNotice: boolean;
  statuses: ByrdispatchStatus[];
};

export type ByrdispatchEntry = {
  date: string;
  sections: ByrdispatchSection[];
  noticeSections: ByrdispatchSection[];
  regularSections: ByrdispatchSection[];
};

function normalizeStatus(value: string): ByrdispatchStatus {
  if (value === "new") return "new";
  if (value === "버그") return "bug";
  return "wip";
}

function extractStatusMarkers(source: string): {
  text: string;
  statuses: ByrdispatchStatus[];
} {
  const statuses: ByrdispatchStatus[] = [];
  let text = source.trim();
  let match = text.match(BYRDISPATCH_STATUS_RE);

  while (match) {
    statuses.unshift(normalizeStatus(match[1]));
    text = text.slice(0, match.index).trimEnd();
    match = text.match(BYRDISPATCH_STATUS_RE);
  }

  return { text, statuses };
}

function parseByrdispatchMarkdown(markdown: string, fallbackDate: string): ByrdispatchEntry {
  const lines = markdown.split(/\r?\n/);
  const h1 = lines.find((line) => line.startsWith("# "))?.slice(2).trim();
  const date = h1 && /^\d{4}-\d{2}-\d{2}$/.test(h1) ? h1 : fallbackDate;
  const sections: ByrdispatchSection[] = [];
  let currentSection: ByrdispatchSection | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("# ")) continue;

    if (line.startsWith("## ") || line.startsWith("### ")) {
      const level: 2 | 3 = line.startsWith("### ") ? 3 : 2;
      const rawTitle = line.slice(level + 1).trim();
      const { text: title, statuses } = extractStatusMarkers(rawTitle);
      currentSection = {
        title,
        level,
        bullets: [],
        isNotice: title === BYRDISPATCH_NOTICE_SECTION,
        statuses,
      };
      sections.push(currentSection);
      continue;
    }

    if (currentSection && line.startsWith("- ")) {
      currentSection.bullets.push(extractStatusMarkers(line.slice(2)));
    }
  }

  const populatedSections = sections.filter((section, index) => {
    if (section.bullets.length > 0) return true;
    if (section.level !== 2) return false;

    for (const nextSection of sections.slice(index + 1)) {
      if (nextSection.level === 2) return false;
      if (nextSection.bullets.length > 0) return true;
    }

    return false;
  });
  const noticeSections = populatedSections.filter((section) => section.isNotice);
  const regularSections = populatedSections.filter((section) => !section.isNotice);

  return {
    date,
    sections: populatedSections,
    noticeSections,
    regularSections,
  };
}

export async function getByrdispatchEntries(): Promise<ByrdispatchEntry[]> {
  let filenames: string[];
  try {
    filenames = await fs.readdir(BYRDISPATCH_DIR);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const entries = await Promise.all(
    filenames
      .filter((filename) => BYRDISPATCH_FILE_RE.test(filename))
      .map(async (filename) => {
        const markdown = await fs.readFile(path.join(BYRDISPATCH_DIR, filename), "utf-8");
        return parseByrdispatchMarkdown(markdown, filename.slice(0, -3));
      }),
  );

  return entries
    .filter((entry) => entry.sections.length > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function getLatestByrdispatchEntry(): Promise<ByrdispatchEntry | null> {
  return (await getByrdispatchEntries())[0] ?? null;
}

export async function getLatestByrdispatchNotice(): Promise<ByrdispatchNotice | null> {
  for (const entry of await getByrdispatchEntries()) {
    const text = entry.noticeSections[0]?.bullets[0]?.text;
    if (text) {
      return {
        date: entry.date,
        text: text.replace(BYRDISPATCH_MARKDOWN_LINK_RE, "$1"),
      };
    }
  }

  return null;
}
