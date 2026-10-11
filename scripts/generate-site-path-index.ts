import fs from "node:fs";
import path from "node:path";
import { neowsletterBodyLines, neowsletterClaimHref, neowsletterLineHref } from "../src/lib/neowsletter-anchors";
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
  };
}

function main() {
  const ko = serviceMessages.ko;
  const en = serviceMessages.en;
  const entries: SitePathEntry[] = [
    page("/patches", ko.patchNotes.indexTitle, en.patchNotes.indexTitle),
    page("/patches/neowsletters", ko.neowsletters.indexTitle, en.neowsletters.indexTitle, ko.neowsletters.metadataDescription, en.neowsletters.metadataDescription),
    page("/compendium", ko.codex.metadataGameTitle, en.codex.metadataGameTitle),
    page("/compendium/cards", ko.codex.cards, en.codex.cards),
    page("/compendium/relics", ko.codex.relics, en.codex.relics),
    page("/compendium/potions", ko.codex.potions, en.codex.potions),
    page("/compendium/powers", ko.codex.powers, en.codex.powers),
    page("/compendium/enchantments", ko.codex.enchantments, en.codex.enchantments),
    page("/compendium/events", ko.codex.events, en.codex.events),
    page("/compendium/monsters", ko.codex.monsters, en.codex.monsters),
    page("/compendium/ancients", ko.codex.ancients, en.codex.ancients),
    page("/compendium/characters", ko.codex.characters, en.codex.characters),
    page("/compendium/keywords", ko.codex.keywords, en.codex.keywords),
    page("/compendium/epochs", ko.codex.epochs, en.codex.epochs),
    page("/compendium/badges", ko.codex.badges, en.codex.badges),
    page("/compendium/modifiers", ko.codex.modifiers, en.codex.modifiers),
    page("/compendium/ascensions", ko.codex.ascensions, en.codex.ascensions),
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
    });
    const koDoc = splitNeowsletterDocument(fs.readFileSync(path.join(notesDir, `${issue.id}.ko.md`), "utf8"));
    const enDoc = splitNeowsletterDocument(fs.readFileSync(path.join(notesDir, `${issue.id}.md`), "utf8"));
    const enById = new Map(enDoc.claims.map((claim) => [claim.id, claim.markdown]));
    for (const claim of koDoc.claims) {
      const enMarkdown = enById.get(claim.id) ?? "";
      const sectionKo = heading(claim.markdown) || clip(plain(neowsletterBodyLines(claim.markdown)[0] ?? issue.titleKo));
      const sectionEn = heading(enMarkdown) || clip(plain(neowsletterBodyLines(enMarkdown)[0] ?? issue.title));
      entries.push({
        href: neowsletterClaimHref(issue.id, claim.id),
        kind: "neowsletter-section",
        labelKo: sectionKo,
        labelEn: sectionEn,
        titleKo: `${issue.titleKo} · ${sectionKo}`,
        titleEn: `${issue.title} · ${sectionEn}`,
        previewKo: clip(plain(neowsletterBodyLines(claim.markdown)[0] ?? ""), 140),
        previewEn: clip(plain(neowsletterBodyLines(enMarkdown)[0] ?? ""), 140),
      });
      const koLines = neowsletterBodyLines(claim.markdown);
      const enLines = neowsletterBodyLines(enMarkdown);
      const count = Math.max(koLines.length, enLines.length);
      for (let index = 0; index < count; index += 1) {
        const koLine = plain(koLines[index] ?? "");
        const enLine = plain(enLines[index] ?? "");
        if (!koLine && !enLine) continue;
        entries.push({
          href: neowsletterLineHref(issue.id, claim.id, index + 1),
          kind: "neowsletter-line",
          labelKo: clip(koLine || enLine),
          labelEn: clip(enLine || koLine),
          titleKo: `${issue.titleKo} · ${sectionKo}`,
          titleEn: `${issue.title} · ${sectionEn}`,
          previewKo: koLine,
          previewEn: enLine,
        });
      }
    }
  }

  const index: SitePathIndex = { entries };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(index));
  console.log(`Wrote ${entries.length} site paths`);
}

main();
