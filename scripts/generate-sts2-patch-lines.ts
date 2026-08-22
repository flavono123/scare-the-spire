import fs from "fs/promises";
import path from "path";
import { stripCodexMarkup } from "../src/lib/codex-search";
import { getSTS2Patches } from "../src/lib/data";
import { loadAllEntities } from "../src/lib/load-all-entities";
import type { EntityInfo } from "../src/components/patch-note-renderer";
import {
  extractAscensionPatchLabels,
  isNumberedAscensionLabel,
} from "../src/lib/sts2-patch-ascension-refs";
import type { STS2PatchFeaturedEntityType, STS2PatchLine, STS2PatchLineEntityRef } from "../src/lib/types";

const NOTES_DIR = path.join(process.cwd(), "data/sts2-patch-notes");
const OUTPUT_PATH = path.join(process.cwd(), "data/sts2-patch-lines.json");

const SUPPORTED_ENTITY_TYPES = new Set<STS2PatchFeaturedEntityType>([
  "character",
  "card",
  "relic",
  "potion",
  "power",
  "enchantment",
  "affliction",
  "event",
  "monster",
  "encounter",
  "ancient",
  "epoch",
  "modifier",
  "ascension",
]);

type ParsedPatchLine = {
  ordinal: number;
  section: string[];
  markdown: string;
  text: string;
  entityLabels: Array<{ type: STS2PatchFeaturedEntityType; label: string }>;
  details: Array<{ markdown: string; text: string }>;
};

function normalizeVersion(value: string): string {
  return value.replace(/^v/i, "");
}

function normalizeLookup(value: string): string {
  return stripCodexMarkup(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/(?:'s)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function shortHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

function refSlug(refs: STS2PatchLineEntityRef[], fallbackText: string): string {
  const refPart = refs
    .slice(0, 2)
    .map((ref) => `${ref.type}-${ref.id}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"))
    .filter(Boolean)
    .join("-");
  return refPart || `text-${shortHash(fallbackText)}`;
}

function plainPatchLineText(markdown: string): string {
  return stripCodexMarkup(markdown)
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractEntityLabels(markdown: string): ParsedPatchLine["entityLabels"] {
  const labels: ParsedPatchLine["entityLabels"] = [];
  const tagRe = /\[gold:([a-z]+)\]([\s\S]*?)\[\/gold\]/gi;
  let match: RegExpExecArray | null;

  while ((match = tagRe.exec(markdown)) !== null) {
    const type = match[1] as STS2PatchFeaturedEntityType;
    const label = plainPatchLineText(match[2]);
    if (SUPPORTED_ENTITY_TYPES.has(type) && label) labels.push({ type, label });
  }

  return labels;
}

function extractImplicitRunLabels(markdown: string): ParsedPatchLine["entityLabels"] {
  const labels: ParsedPatchLine["entityLabels"] = [];
  const seen = new Set<string>();
  const push = (type: STS2PatchFeaturedEntityType, label: string) => {
    const key = `${type}:${normalizeLookup(label)}`;
    if (!label || seen.has(key)) return;
    seen.add(key);
    labels.push({ type, label });
  };

  const untypedGoldRe = /\[gold\]([\s\S]*?)\[\/gold\]/gi;
  let match: RegExpExecArray | null;
  while ((match = untypedGoldRe.exec(markdown)) !== null) {
    const label = plainPatchLineText(match[1]);
    if (label) push("modifier", label);
  }

  const boldRe = /\*\*([^*]+)\*\*/g;
  while ((match = boldRe.exec(markdown)) !== null) {
    const label = plainPatchLineText(match[1]);
    if (label) push("modifier", label);
  }

  return labels;
}

function buildNameLookup(entities: EntityInfo[]): Map<string, EntityInfo> {
  const lookup = new Map<string, EntityInfo>();
  for (const entity of entities) {
    if (entity.type !== "modifier" && entity.type !== "ascension") continue;
    for (const label of [
      entity.nameKo,
      entity.nameEn,
      ...(entity.aliasesKo ?? []),
      ...(entity.aliasesEn ?? []),
    ]) {
      if (isNumberedAscensionLabel(label)) continue;
      const key = normalizeLookup(label);
      if (key.length < 2 || lookup.has(key)) continue;
      lookup.set(key, entity);
    }
  }
  return lookup;
}

function extractNamedRunLabels(
  text: string,
  nameLookup: Map<string, EntityInfo>,
): ParsedPatchLine["entityLabels"] {
  const labels: ParsedPatchLine["entityLabels"] = [];
  const haystack = normalizeLookup(text);
  if (!haystack) return labels;

  for (const [key, entity] of nameLookup) {
    if (entity.type === "modifier" && entity.modifierData?.source === "characterCards") continue;
    if (key.length < 2) continue;
    if (/^[a-z0-9]+$/.test(key)) continue;
    const found = /^[a-z0-9 ]+$/.test(key)
      ? new RegExp(`(?:^|[^a-z0-9])${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[^a-z0-9])`).test(haystack)
      : haystack.includes(key);
    if (!found) continue;
    labels.push({
      type: entity.type as STS2PatchFeaturedEntityType,
      label: entity.nameKo || entity.nameEn,
    });
  }

  return labels;
}

function parsePatchLines(markdown: string): ParsedPatchLine[] {
  const lines = markdown.split(/\r?\n/);
  const section: string[] = [];
  const results: ParsedPatchLine[] = [];
  let parentLine: ParsedPatchLine | null = null;
  let ordinal = 0;

  for (const line of lines) {
    const headingMatch = line.match(/^(#{2,4})\s+(.+)$/);
    if (headingMatch) {
      const depth = headingMatch[1].length - 2;
      section.splice(depth);
      section[depth] = plainPatchLineText(headingMatch[2]);
      parentLine = null;
      continue;
    }

    const bulletMatch = line.match(/^(\s*)-\s+(.+)$/);
    if (!bulletMatch) continue;

    const indent = Math.floor(bulletMatch[1].length / 2);
    if (indent > 1) continue;

    const markdownLine = bulletMatch[2].trim();
    if (!markdownLine || /^\[monster-pattern-diff:/i.test(markdownLine)) continue;
    if (/^\[character-low-hp-idle(?::[v0-9.]+)?\]/i.test(markdownLine)) continue;
    if (/^\[devnote(?::en)?\]/i.test(markdownLine)) continue;

    const text = plainPatchLineText(markdownLine);
    if (!text) continue;

    ordinal += 1;
    const parsedLine: ParsedPatchLine = {
      ordinal,
      section: section.filter(Boolean),
      markdown: markdownLine,
      text,
      entityLabels: extractEntityLabels(markdownLine),
      details: [],
    };
    results.push(parsedLine);

    if (indent === 0) {
      parentLine = parsedLine;
    } else if (parentLine?.entityLabels.length) {
      parentLine.details.push({ markdown: markdownLine, text });
    }
  }

  return results;
}

function withDetails(line: ParsedPatchLine, field: "markdown" | "text"): string {
  return [line[field], ...line.details.map((detail) => `• ${detail[field]}`)].join("\n");
}

function buildEntityLookup(entities: EntityInfo[]): Map<string, EntityInfo> {
  const lookup = new Map<string, EntityInfo>();
  for (const entity of entities) {
    for (const label of [
      entity.nameKo,
      entity.nameEn,
      ...(entity.aliasesKo ?? []),
      ...(entity.aliasesEn ?? []),
    ]) {
      const key = `${entity.type}:${normalizeLookup(label)}`;
      if (!lookup.has(key)) lookup.set(key, entity);
    }
  }
  return lookup;
}

function resolveEntityRefs(
  labels: ParsedPatchLine["entityLabels"],
  lookup: Map<string, EntityInfo>,
  nameLookup: Map<string, EntityInfo>,
): STS2PatchLineEntityRef[] {
  const refs: STS2PatchLineEntityRef[] = [];
  const seen = new Set<string>();

  for (const { type, label } of labels) {
    const typed = lookup.get(`${type}:${normalizeLookup(label)}`);
    const named = nameLookup.get(normalizeLookup(label));
    const entity = typed ?? (
      (type === "modifier" || type === "ascension") ? named : undefined
    );
    if (!entity || !SUPPORTED_ENTITY_TYPES.has(entity.type as STS2PatchFeaturedEntityType)) continue;

    const key = `${entity.type}:${entity.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push({
      type: entity.type as STS2PatchFeaturedEntityType,
      id: entity.id,
      label,
    });
  }

  return refs;
}

function lineSearchText(line: {
  id: string;
  patch: string;
  version: string;
  section: string[];
  textKo: string;
  textEn?: string;
  entityRefs: STS2PatchLineEntityRef[];
}, entityByKey: Map<string, EntityInfo>): string {
  const parts = [
    line.id,
    line.patch,
    line.version,
    ...line.section,
    line.textKo,
    line.textEn,
  ];

  for (const ref of line.entityRefs) {
    const entity = entityByKey.get(`${ref.type}:${ref.id}`);
    parts.push(ref.type, ref.id, ref.label, entity?.nameKo, entity?.nameEn, entity?.aliasesKo?.join(" "), entity?.aliasesEn?.join(" "));
  }

  return parts
    .filter((part): part is string => Boolean(part))
    .map(normalizeLookup)
    .filter(Boolean)
    .join(" ");
}

async function readMarkdown(version: string, localeSuffix: "" | ".ko"): Promise<string> {
  return fs.readFile(path.join(NOTES_DIR, `v${version}${localeSuffix}.md`), "utf-8").catch(() => "");
}

async function main() {
  const [patches, entities] = await Promise.all([
    getSTS2Patches(),
    loadAllEntities({ gameLocale: "kor" }),
  ]);
  const entityLookup = buildEntityLookup(entities);
  const nameLookup = buildNameLookup(entities);
  const entityByKey = new Map(entities.map((entity) => [`${entity.type}:${entity.id}`, entity]));
  const output: STS2PatchLine[] = [];

  for (const patch of patches) {
    const [markdownKo, markdownEn] = await Promise.all([
      readMarkdown(patch.version, ".ko"),
      readMarkdown(patch.version, ""),
    ]);
    const koLines = parsePatchLines(markdownKo || markdownEn);
    const enLines = parsePatchLines(markdownEn);

    for (const koLine of koLines) {
      const enLine = enLines.find((candidate) => candidate.ordinal === koLine.ordinal);
      const combinedLabels = [
        ...koLine.entityLabels,
        ...extractImplicitRunLabels(koLine.markdown),
        ...extractAscensionPatchLabels(withDetails(koLine, "markdown")),
        ...extractNamedRunLabels(koLine.text, nameLookup),
      ];
      const entityRefs = resolveEntityRefs(combinedLabels, entityLookup, nameLookup);
      const id = `${patch.id}:line-${String(koLine.ordinal).padStart(3, "0")}-${refSlug(entityRefs, koLine.text)}`;
      const line: STS2PatchLine = {
        id,
        patch: patch.id,
        version: normalizeVersion(patch.version),
        date: patch.date,
        section: koLine.section,
        markdownKo: withDetails(koLine, "markdown"),
        markdownEn: enLine ? withDetails(enLine, "markdown") : undefined,
        summaryMarkdownKo: koLine.details.length > 0 ? koLine.markdown : undefined,
        summaryMarkdownEn: enLine && enLine.details.length > 0 ? enLine.markdown : undefined,
        textKo: withDetails(koLine, "text"),
        textEn: enLine ? withDetails(enLine, "text") : undefined,
        entityRefs,
        searchText: "",
      };
      line.searchText = lineSearchText(line, entityByKey);
      output.push(line);
    }
  }

  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Wrote ${path.relative(process.cwd(), OUTPUT_PATH)} (${output.length} lines)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
