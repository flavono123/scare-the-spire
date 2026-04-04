import { notFound } from "next/navigation";
import Link from "next/link";
import fs from "fs/promises";
import path from "path";
import { getSTS2Patches } from "@/lib/data";
import { getCodexCards, getCodexRelics, getCodexPotions, getCodexPowers, getCodexEnchantments, getCodexEvents } from "@/lib/codex-data";
import { Badge } from "@/components/ui/badge";
import {
  PatchNoteRenderer,
  type EntityInfo,
} from "@/components/patch-note-renderer";
import type { PatchType } from "@/lib/types";

const PATCH_TYPE_STYLES: Record<PatchType, { label: string; className: string }> = {
  release: { label: "출시", className: "bg-green-500/15 text-green-400 border-green-500/30" },
  beta: { label: "베타", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  stable: { label: "안정", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  hotfix: { label: "핫픽스", className: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
};

const NOTES_DIR = path.join(process.cwd(), "data/sts2-patch-notes");

export async function generateStaticParams() {
  const patches = await getSTS2Patches();
  return patches.map((p) => ({ version: p.version }));
}

export default async function PatchDetailPage({
  params,
}: {
  params: Promise<{ version: string }>;
}) {
  const { version } = await params;
  const [patches, codexCards, codexRelics, codexPotions, codexPowers, codexEnchantments, codexEvents] = await Promise.all([
    getSTS2Patches(),
    getCodexCards(),
    getCodexRelics(),
    getCodexPotions(),
    getCodexPowers(),
    getCodexEnchantments(),
    getCodexEvents(),
  ]);

  const patch = patches.find((p) => p.version === version);
  if (!patch) notFound();

  // Read Korean patch notes first, fallback to English
  let markdown = "";
  const koPath = path.join(NOTES_DIR, `v${patch.version}.ko.md`);
  const enPath = path.join(NOTES_DIR, `v${patch.version}.md`);
  try {
    markdown = await fs.readFile(koPath, "utf-8");
  } catch {
    try {
      markdown = await fs.readFile(enPath, "utf-8");
    } catch {
      // No patch notes file yet
    }
  }

  // Build entity info for the renderer (cards + relics + potions)
  const entities: EntityInfo[] = [
    ...codexCards.map((c) => ({
      id: c.id,
      nameEn: c.nameEn,
      nameKo: c.name,
      imageUrl: c.imageUrl,
      color: c.color,
      type: "card" as const,
      cardData: c,
    })),
    ...codexRelics.map((r) => ({
      id: r.id,
      nameEn: r.nameEn,
      nameKo: r.name,
      imageUrl: r.imageUrl,
      color: r.pool,
      type: "relic" as const,
      relicData: r,
    })),
    ...codexPotions.map((p) => ({
      id: p.id,
      nameEn: p.nameEn,
      nameKo: p.name,
      imageUrl: p.imageUrl,
      color: p.pool,
      type: "potion" as const,
      potionData: p,
    })),
    ...codexPowers.map((p) => ({
      id: p.id,
      nameEn: p.nameEn,
      nameKo: p.name,
      imageUrl: p.imageUrl,
      color: p.type,
      type: "power" as const,
      powerData: p,
    })),
    ...codexEnchantments.map((e) => ({
      id: e.id,
      nameEn: e.nameEn,
      nameKo: e.name,
      imageUrl: e.imageUrl,
      color: e.cardType ?? "Any",
      type: "enchantment" as const,
      enchantmentData: e,
    })),
    ...codexEvents.map((e) => ({
      id: e.id,
      nameEn: e.nameEn,
      nameKo: e.name,
      imageUrl: e.imageUrl,
      color: e.act ?? "none",
      type: "event" as const,
      eventData: e,
    })),
    // Event options (choices) — hover shows option rich text
    ...codexEvents.flatMap((e) =>
      (e.options ?? [])
        .filter((o) => !o.id.endsWith("_LOCKED") && o.title !== "잠김" && o.description)
        .map((o) => ({
          id: `${e.id}__${o.id}`,
          nameEn: "",
          nameKo: o.title,
          imageUrl: null,
          color: e.act ?? "none",
          type: "event" as const,
          eventData: e,
          eventOptionDesc: o.description,
        })),
    ),
  ];

  const style = PATCH_TYPE_STYLES[patch.type];

  // Adjacent patches for navigation
  const sortedPatches = [...patches].sort((a, b) => a.date.localeCompare(b.date));
  const idx = sortedPatches.findIndex((p) => p.id === patch.id);
  const prevPatch = idx > 0 ? sortedPatches[idx - 1] : null;
  const nextPatch = idx < sortedPatches.length - 1 ? sortedPatches[idx + 1] : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Link
        href="/patches"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        &larr; 패치 목록
      </Link>

      <div className="mt-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">v{patch.version}</h1>
          <Badge variant="outline" className={style.className}>
            {style.label}
          </Badge>
        </div>
        <p className="mt-1 text-lg font-medium">{patch.titleKo}</p>
        <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
          <span>{patch.date}</span>
          {patch.steamUrl && (
            <a
              href={patch.steamUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              Steam 원문 &rarr;
            </a>
          )}
        </div>
      </div>

      {/* Patch notes body */}
      {markdown ? (
        <section className="mt-6">
          <PatchNoteRenderer markdown={markdown} entities={entities} />
        </section>
      ) : (
        <div className="mt-8 rounded-lg border border-border bg-card/30 p-6 text-center text-sm text-muted-foreground">
          패치 노트 원문이 아직 준비되지 않았습니다.
        </div>
      )}

      {/* Patch navigation */}
      <div className="mt-8 flex items-center justify-between border-t border-border pt-4">
        {prevPatch ? (
          <Link
            href={`/patches/${prevPatch.version}`}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            &larr; v{prevPatch.version}
          </Link>
        ) : (
          <span />
        )}
        {nextPatch ? (
          <Link
            href={`/patches/${nextPatch.version}`}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            v{nextPatch.version} &rarr;
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
