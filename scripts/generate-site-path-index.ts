import fs from "node:fs";
import path from "node:path";
import {
  neowsletterBodyLines,
  neowsletterClaimHref,
  neowsletterSectionHeading,
} from "../src/lib/neowsletter-anchors";
import { splitNeowsletterDocument } from "../src/lib/neowsletters";
import { patchSectionAnchorIds, patchSectionHeadings } from "../src/lib/patch-section-anchors";
import type { SitePathEntry, SitePathIndex } from "../src/lib/site-paths";
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
  art?: { imageUrl?: string; alt?: string; altKo?: string };
};

const OUT = path.join(process.cwd(), "public/generated/site-path-index.json");

function plain(raw: string): string {
  const image = raw.trim().match(/^!\[([^\]]*)]\([^)]+\)$/);
  if (image) return image[1].trim() || "그림";
  return raw
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/\[(?:gold|blue|red|green|b|i|s)(?::[^\]]+)?]/g, "")
    .replace(/\[\/(?:gold|blue|red|green|b|i|s)]/g, "")
    .replace(/^#{1,6}\s+/, "")
    .replace(/^[-*]\s+/, "")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function shortIssueTitle(title: string): string {
  return title.replace(/^(?:니오우스레터|The Neowsletter)\s*[—-]\s*/i, "").trim() || title;
}

function seriesLabel(seriesKo: string, seriesEn: string, titleKo: string, titleEn: string, anchorKo = "", anchorEn = ""): { labelKo: string; labelEn: string } {
  const ko = `${seriesKo} — ${titleKo}`;
  const en = `${seriesEn} — ${titleEn}`;
  return {
    labelKo: anchorKo ? `${ko}#${anchorKo}` : ko,
    labelEn: anchorEn ? `${en}#${anchorEn}` : en,
  };
}

function clip(text: string, max = 48): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
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
  ];

  const notesDirPatches = path.join(process.cwd(), "data/sts2-patch-notes");
  const patches = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/sts2-patches.json"), "utf8")) as Patch[];
  for (const patch of [...patches].reverse()) {
    const labels = seriesLabel(ko.patchNotes.indexTitle, en.patchNotes.indexTitle, patch.titleKo, patch.title);
    const href = `/patches/${patch.version}`;
    entries.push({
      href,
      kind: "patch",
      labelKo: labels.labelKo,
      labelEn: labels.labelEn,
      titleKo: patch.titleKo,
      titleEn: patch.title,
      previewKo: patch.summaryKo,
      previewEn: patch.summary,
      ogImage: patch.art?.imageUrl,
      ogImageAltKo: patch.art?.altKo,
      ogImageAltEn: patch.art?.alt,
    });
    const enPath = path.join(notesDirPatches, `v${patch.version}.md`);
    const koPath = path.join(notesDirPatches, `v${patch.version}.ko.md`);
    if (!fs.existsSync(enPath) && !fs.existsSync(koPath)) continue;
    const enMarkdown = fs.existsSync(enPath) ? fs.readFileSync(enPath, "utf8") : "";
    const koMarkdown = fs.existsSync(koPath) ? fs.readFileSync(koPath, "utf8") : enMarkdown;
    const canonical = enMarkdown || koMarkdown;
    const ids = patchSectionAnchorIds(canonical, koMarkdown || canonical);
    const headingsKo = patchSectionHeadings(koMarkdown || canonical);
    const headingsEn = patchSectionHeadings(enMarkdown || canonical);
    const shared = Math.min(ids.length, headingsKo.length, headingsEn.length);
    for (let index = 0; index < shared; index += 1) {
      const anchorKo = headingsKo[index];
      const anchorEn = headingsEn[index];
      if (!anchorKo || !anchorEn || !ids[index]) continue;
      const anchorLabels = seriesLabel(
        ko.patchNotes.indexTitle,
        en.patchNotes.indexTitle,
        patch.titleKo,
        patch.title,
        anchorKo,
        anchorEn,
      );
      entries.push({
        href: `${href}#${ids[index]}`,
        kind: "patch-section",
        labelKo: anchorLabels.labelKo,
        labelEn: anchorLabels.labelEn,
        titleKo: patch.titleKo,
        titleEn: patch.title,
        previewKo: patch.summaryKo,
        previewEn: patch.summary,
        ogImage: patch.art?.imageUrl,
        ogImageAltKo: patch.art?.altKo,
        ogImageAltEn: patch.art?.alt,
      });
    }
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
      const claimIndex = koDoc.claims.indexOf(claim);
      const sectionKo = neowsletterSectionHeading(koDoc.claims, claimIndex);
      const sectionEn = neowsletterSectionHeading(enDoc.claims, enDoc.claims.findIndex((item) => item.id === claim.id));
      if (!sectionKo && !sectionEn) continue;
      const anchorKo = sectionKo || sectionEn;
      const anchorEn = sectionEn || sectionKo;
      const anchorLabels = seriesLabel(
        "니오우스레터",
        "Neowsletter",
        shortIssueTitle(issue.titleKo),
        shortIssueTitle(issue.title),
        anchorKo,
        anchorEn,
      );
      entries.push({
        href: neowsletterClaimHref(issue.id, claim.id),
        kind: "neowsletter-section",
        labelKo: anchorLabels.labelKo,
        labelEn: anchorLabels.labelEn,
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
