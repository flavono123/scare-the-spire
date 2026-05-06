import { notFound } from "next/navigation";
import Link from "next/link";
import fs from "fs/promises";
import path from "path";
import { getSTS2Patches } from "@/lib/data";
import { getCodexCards, getCodexRelics, getCodexPotions, getCodexPowers, getCodexEnchantments, getCodexEvents, getCodexMonsters, getCodexEncounters } from "@/lib/codex-data";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
  localizeHrefWithGameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import {
  PatchNoteRenderer,
  type EntityInfo,
} from "@/components/patch-note-renderer";
import { CommentSection } from "@/components/comment-section";
import { buildPatchCommentThreadKey } from "@/lib/comment-threads";
import type { PatchType } from "@/lib/types";

const PATCH_COPY: Record<ServiceLocale, {
  backToList: string;
  steamOriginal: string;
  missing: string;
  comments: string;
  types: Record<PatchType, string>;
}> = {
  ko: {
    backToList: "패치 목록",
    steamOriginal: "Steam 원문",
    missing: "패치 노트 원문이 아직 준비되지 않았습니다.",
    comments: "댓글",
    types: {
      release: "출시",
      beta: "베타",
      stable: "안정",
      hotfix: "핫픽스",
    },
  },
  en: {
    backToList: "Patch list",
    steamOriginal: "Steam original",
    missing: "Patch notes are not ready yet.",
    comments: "Comments",
    types: {
      release: "Release",
      beta: "Beta",
      stable: "Stable",
      hotfix: "Hotfix",
    },
  },
};

const PATCH_TYPE_CLASSES: Record<PatchType, string> = {
  release: "bg-green-500/15 text-green-400 border-green-500/30",
  beta: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  stable: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  hotfix: "bg-orange-500/15 text-orange-400 border-orange-500/30",
};

const NOTES_DIR = path.join(process.cwd(), "data/sts2-patch-notes");

export async function generateStaticParams() {
  const patches = await getSTS2Patches();
  return patches.map((p) => ({ version: p.version }));
}

export default async function PatchDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ version: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { version } = await params;
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const copy = PATCH_COPY[serviceLocale];
  const [patches, codexCards, codexRelics, codexPotions, codexPowers, codexEnchantments, codexEvents, codexMonsters, codexEncounters, gameUi] = await Promise.all([
    getSTS2Patches(),
    getCodexCards({ includeDeprecated: true, gameLocale }),
    getCodexRelics({ gameLocale }),
    getCodexPotions({ gameLocale }),
    getCodexPowers({ gameLocale }),
    getCodexEnchantments({ gameLocale }),
    getCodexEvents({ gameLocale }),
    getCodexMonsters({ gameLocale }),
    getCodexEncounters({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);

  const patch = patches.find((p) => p.version === version);
  if (!patch) notFound();

  let markdown = "";
  const koPath = path.join(NOTES_DIR, `v${patch.version}.ko.md`);
  const enPath = path.join(NOTES_DIR, `v${patch.version}.md`);
  const preferredPath = serviceLocale === "ko" ? koPath : enPath;
  const fallbackPath = serviceLocale === "ko" ? enPath : koPath;
  try {
    markdown = await fs.readFile(preferredPath, "utf-8");
  } catch {
    try {
      markdown = await fs.readFile(fallbackPath, "utf-8");
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
    ...codexMonsters.map((m) => ({
      id: m.id,
      nameEn: m.nameEn,
      nameKo: m.name,
      imageUrl: m.bossImageUrl ?? m.imageUrl,
      color: m.type,
      type: "monster" as const,
      monsterData: m,
    })),
    ...codexEncounters.map((e) => ({
      id: e.id,
      nameEn: e.nameEn,
      nameKo: e.name,
      imageUrl: e.imageUrl,
      color: e.roomType,
      type: "encounter" as const,
      encounterData: e,
    })),
  ];

  const title = serviceLocale === "ko" ? patch.titleKo : patch.title;
  const commentEntities = entities.filter((entity) => !entity.eventOptionDesc);

  // Adjacent patches for navigation
  const sortedPatches = [...patches].sort((a, b) => a.date.localeCompare(b.date));
  const idx = sortedPatches.findIndex((p) => p.id === patch.id);
  const prevPatch = idx > 0 ? sortedPatches[idx - 1] : null;
  const nextPatch = idx < sortedPatches.length - 1 ? sortedPatches[idx + 1] : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Link
        href={localizeHrefWithGameLocale("/patches", serviceLocale, gameLocale)}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        &larr; {copy.backToList}
      </Link>

      <div className="mt-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">v{patch.version}</h1>
          <Badge variant="outline" className={PATCH_TYPE_CLASSES[patch.type]}>
            {copy.types[patch.type]}
          </Badge>
        </div>
        <p className="mt-1 text-lg font-medium">{title}</p>
        <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
          <span>{patch.date}</span>
          {patch.steamUrl && (
            <a
              href={patch.steamUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              {copy.steamOriginal} &rarr;
            </a>
          )}
        </div>
      </div>

      {/* Patch notes body */}
      {markdown ? (
        <section className="mt-6">
          <PatchNoteRenderer
            markdown={markdown}
            entities={entities}
            gameUi={gameUi}
            serviceLocale={serviceLocale}
            gameLocale={gameLocale}
            preferEntityLocaleLabel={serviceLocale !== "ko" || gameLocale !== "kor"}
          />
        </section>
      ) : (
        <div className="mt-8 rounded-lg border border-border bg-card/30 p-6 text-center text-sm text-muted-foreground">
          {copy.missing}
        </div>
      )}

      <section className="mt-8 rounded-lg border border-border bg-card/20 p-4">
        <h2 className="mb-3 text-sm font-bold text-foreground">{copy.comments}</h2>
        <CommentSection
          threadKey={buildPatchCommentThreadKey(patch.version)}
          initialEntities={commentEntities}
        />
      </section>

      {/* Patch navigation */}
      <div className="mt-8 flex items-center justify-between border-t border-border pt-4">
        {prevPatch ? (
          <Link
            href={localizeHrefWithGameLocale(`/patches/${prevPatch.version}`, serviceLocale, gameLocale)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            &larr; v{prevPatch.version}
          </Link>
        ) : (
          <span />
        )}
        {nextPatch ? (
          <Link
            href={localizeHrefWithGameLocale(`/patches/${nextPatch.version}`, serviceLocale, gameLocale)}
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
