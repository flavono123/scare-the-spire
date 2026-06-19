import fs from "fs/promises";
import path from "path";
import {
  SHA_NEWS_ICON,
  SHA_NEWS_NOTICE_ICON,
  type ShaNewsNotice,
} from "@/lib/sha-news-static";

export { SHA_NEWS_ICON, SHA_NEWS_NOTICE_ICON, type ShaNewsNotice };

const SHA_NEWS_DIR = path.join(process.cwd(), "data/sha-news");
const SHA_NEWS_FILE_RE = /^\d{4}-\d{2}-\d{2}\.md$/;
const SHA_NEWS_NOTICE_SECTION = "공지";
const SHA_NEWS_STATUS_RE = /\s*\((new|개발 중|버그)\)\s*$/;
const SHA_NEWS_MARKDOWN_LINK_RE = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g;

export type ShaNewsStatus = "new" | "wip" | "bug";

export type ShaNewsBullet = {
  text: string;
  statuses: ShaNewsStatus[];
};

export type ShaNewsSection = {
  title: string;
  level: 2 | 3;
  bullets: ShaNewsBullet[];
  isNotice: boolean;
  statuses: ShaNewsStatus[];
};

export type ShaNewsEntry = {
  date: string;
  sections: ShaNewsSection[];
  noticeSections: ShaNewsSection[];
  regularSections: ShaNewsSection[];
};

function normalizeStatus(value: string): ShaNewsStatus {
  if (value === "new") return "new";
  if (value === "버그") return "bug";
  return "wip";
}

function extractStatusMarkers(source: string): {
  text: string;
  statuses: ShaNewsStatus[];
} {
  const statuses: ShaNewsStatus[] = [];
  let text = source.trim();
  let match = text.match(SHA_NEWS_STATUS_RE);

  while (match) {
    statuses.unshift(normalizeStatus(match[1]));
    text = text.slice(0, match.index).trimEnd();
    match = text.match(SHA_NEWS_STATUS_RE);
  }

  return { text, statuses };
}

function parseShaNewsMarkdown(markdown: string, fallbackDate: string): ShaNewsEntry {
  const lines = markdown.split(/\r?\n/);
  const h1 = lines.find((line) => line.startsWith("# "))?.slice(2).trim();
  const date = h1 && /^\d{4}-\d{2}-\d{2}$/.test(h1) ? h1 : fallbackDate;
  const sections: ShaNewsSection[] = [];
  let currentSection: ShaNewsSection | null = null;

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
        isNotice: title === SHA_NEWS_NOTICE_SECTION,
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

export async function getShaNewsEntries(): Promise<ShaNewsEntry[]> {
  let filenames: string[];
  try {
    filenames = await fs.readdir(SHA_NEWS_DIR);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const entries = await Promise.all(
    filenames
      .filter((filename) => SHA_NEWS_FILE_RE.test(filename))
      .map(async (filename) => {
        const markdown = await fs.readFile(path.join(SHA_NEWS_DIR, filename), "utf-8");
        return parseShaNewsMarkdown(markdown, filename.slice(0, -3));
      }),
  );

  return entries
    .filter((entry) => entry.sections.length > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function getLatestShaNewsEntry(): Promise<ShaNewsEntry | null> {
  return (await getShaNewsEntries())[0] ?? null;
}

export async function getLatestShaNewsNotice(): Promise<ShaNewsNotice | null> {
  for (const entry of await getShaNewsEntries()) {
    const text = entry.noticeSections[0]?.bullets[0]?.text;
    if (text) {
      return {
        date: entry.date,
        text: text.replace(SHA_NEWS_MARKDOWN_LINK_RE, "$1"),
      };
    }
  }

  return null;
}
