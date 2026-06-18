import fs from "fs/promises";
import path from "path";

export const SHA_NEWS_ICON = "/images/sts2/relics/byrdpip.webp";
export const SHA_NEWS_VERSION = "2026-06-09";
export const SHA_NEWS_ENABLED = process.env.NODE_ENV !== "production";

const SHA_NEWS_DIR = path.join(process.cwd(), "data/sha-news");
const SHA_NEWS_FILE_RE = /^\d{4}-\d{2}-\d{2}\.md$/;
const SHA_NEWS_NOTICE_SECTION = "공지";

export type ShaNewsSection = {
  title: string;
  bullets: string[];
  isNotice: boolean;
};

export type ShaNewsEntry = {
  date: string;
  sections: ShaNewsSection[];
  noticeSections: ShaNewsSection[];
  regularSections: ShaNewsSection[];
};

function parseShaNewsMarkdown(markdown: string, fallbackDate: string): ShaNewsEntry {
  const lines = markdown.split(/\r?\n/);
  const h1 = lines.find((line) => line.startsWith("# "))?.slice(2).trim();
  const date = h1 && /^\d{4}-\d{2}-\d{2}$/.test(h1) ? h1 : fallbackDate;
  const sections: ShaNewsSection[] = [];
  let currentSection: ShaNewsSection | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("# ")) continue;

    if (line.startsWith("## ")) {
      const title = line.slice(3).trim();
      currentSection = {
        title,
        bullets: [],
        isNotice: title === SHA_NEWS_NOTICE_SECTION,
      };
      sections.push(currentSection);
      continue;
    }

    if (currentSection && line.startsWith("- ")) {
      currentSection.bullets.push(line.slice(2).trim());
    }
  }

  const populatedSections = sections.filter((section) => section.bullets.length > 0);
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
