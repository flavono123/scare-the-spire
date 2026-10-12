import fs from "node:fs";
import path from "node:path";
import { neowsletterBodyLines, neowsletterClaimHref } from "../src/lib/neowsletter-anchors";
import { splitNeowsletterDocument } from "../src/lib/neowsletters";
import type { SitePathEntry, SitePathIndex } from "../src/lib/site-paths";
import { getDefragmentNavTitle } from "../src/lib/borrowed-game-copy";
import { serviceMessages } from "../src/messages/service";

type Issue = {
  id: string;
  title: string;
  titleKo: string;
  summary: string;
  summaryKo: string;
  imageUrl?: string;
  imageAlt?: string;
  imageAltKo?: string;
};

type Patch = {
  version: string;
  title: string;
  titleKo: string;
  summary: string;
  summaryKo: string;
};

const OUT = path.join(process.cwd(), "public/generated/site-path-index.json");

function plain(raw: string): string {
  const image = raw.trim().match(/^!\[([^\]]*)]\([^)]+\)$/);
  if (image) return image[1].trim() || "그림";
  return raw
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/\[(?:gold|blue|red|green)(?::[^\]]+)?]/g, "")
    .replace(/\[\/(?:gold|blue|red|green)]/g, "")
    .replace(/^#{1,6}\s+/, "")
    .replace(/^[-*]\s+/, "")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function shortIssueTitle(title: string): string {
  return title.replace(/^(?:니오우스레터|The Neowsletter)\s*[—-]\s*/i, "").trim() || title;
}

function clip(text: string, max = 48): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function heading(markdown: string): string {
  const line = markdown.split("\n").find((item) => /^#{1,6}\s+/.test(item.trim()));
  return line ? plain(line) : "";
}

function page(
  href: string,
  labelKo: string,
  labelEn: string,
  previewKo = "",
  previewEn = "",
  ogImage = "",
  ogImageAltKo = "",
  ogImageAltEn = "",
): SitePathEntry {
  return {
    href,
    kind: "page",
    labelKo,
    labelEn,
    titleKo: labelKo,
    titleEn: labelEn,
    previewKo,
    previewEn,
    ogImage,
    ogImageAltKo,
    ogImageAltEn,
  };
}

function main() {
  const ko = serviceMessages.ko;
  const en = serviceMessages.en;
  const entries: SitePathEntry[] = [
    page("/patches", ko.patchNotes.indexTitle, en.patchNotes.indexTitle),
    page(
      "/patches/neowsletters",
      ko.neowsletters.indexTitle,
      en.neowsletters.indexTitle,
      ko.neowsletters.metadataDescription,
      en.neowsletters.metadataDescription,
      "/images/sts2/cards/neows_fury.webp",
      "니오우의 격분",
      "Neow's Fury",
    ),
    page("/pagestorm", ko.pagestorm.title, en.pagestorm.title, ko.pagestorm.subtitle, en.pagestorm.subtitle),
    page("/defragment", getDefragmentNavTitle("kor"), getDefragmentNavTitle("eng"), ko.defragment.subtitle, en.defragment.subtitle),
  ];

  const patches = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/sts2-patches.json"), "utf8")) as Patch[];
  for (const patch of patches) {
    entries.push(page(
      `/patches/${patch.version}`,
      patch.titleKo,
      patch.title,
      patch.summaryKo,
      patch.summary,
    ));
  }

  const issues = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/sts2-neowsletters.json"), "utf8")) as Issue[];
  const notesDir = path.join(process.cwd(), "data/sts2-neowsletters");
  for (const issue of issues) {
    const href = `/patches/neowsletters/${issue.id}`;
    entries.push({
      href,
      kind: "neowsletter",
      labelKo: issue.titleKo,
      labelEn: issue.title,
      titleKo: issue.titleKo,
      titleEn: issue.title,
      previewKo: issue.summaryKo,
      previewEn: issue.summary,
      ogImage: issue.imageUrl,
      ogImageAltKo: issue.imageAltKo ?? issue.titleKo,
      ogImageAltEn: issue.imageAlt ?? issue.title,
    });
    const koDoc = splitNeowsletterDocument(fs.readFileSync(path.join(notesDir, `${issue.id}.ko.md`), "utf8"));
    const enDoc = splitNeowsletterDocument(fs.readFileSync(path.join(notesDir, `${issue.id}.md`), "utf8"));
    const enById = new Map(enDoc.claims.map((claim) => [claim.id, claim.markdown]));
    for (const claim of koDoc.claims) {
      const enMarkdown = enById.get(claim.id) ?? "";
      const sectionKo = heading(claim.markdown);
      const sectionEn = heading(enMarkdown);
      if (!sectionKo && !sectionEn) continue;
      const anchorKo = sectionKo || sectionEn;
      const anchorEn = sectionEn || sectionKo;
      entries.push({
        href: neowsletterClaimHref(issue.id, claim.id),
        kind: "neowsletter-section",
        labelKo: `니오우스레터/${shortIssueTitle(issue.titleKo)}#${anchorKo}`,
        labelEn: `Neowsletter/${shortIssueTitle(issue.title)}#${anchorEn}`,
        titleKo: issue.titleKo,
        titleEn: issue.title,
        previewKo: clip(plain(neowsletterBodyLines(claim.markdown)[0] ?? anchorKo), 140),
        previewEn: clip(plain(neowsletterBodyLines(enMarkdown)[0] ?? anchorEn), 140),
        ogImage: issue.imageUrl,
        ogImageAltKo: issue.imageAltKo ?? issue.titleKo,
        ogImageAltEn: issue.imageAlt ?? issue.title,
      });
    }
  }

  const index: SitePathIndex = { entries };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(index));
  console.log(`Wrote ${entries.length} site paths`);
}

main();
