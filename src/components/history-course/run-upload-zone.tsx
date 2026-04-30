"use client";

import Image from "next/image";
import { AlertCircle, FolderUp, RefreshCw, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { saveRun } from "@/lib/run-store";
import {
  isBuildSupported,
  MIN_SUPPORTED_BUILD,
} from "@/lib/sts2-build-version";
import { computeRunHash, runRouteSlug } from "@/lib/sts2-run-hash";
import { parseReplayRun, type ReplayRun } from "@/lib/sts2-run-replay";
import { cn } from "@/lib/utils";

export type ParsedRun = {
  fileName: string;
  raw: string;
  run: ReplayRun;
  hash: string;
  slug: string;
};

type ParseError = {
  fileName: string;
  message: string;
};

const CHARACTER_META: Record<
  string,
  { ko: string; ring: string; text: string; icon: string }
> = {
  "CHARACTER.IRONCLAD": {
    ko: "아이언클래드",
    ring: "ring-red-400/30",
    text: "text-red-300",
    icon: "/images/sts2/icons/ironclad_energy_icon.webp",
  },
  "CHARACTER.SILENT": {
    ko: "사일런트",
    ring: "ring-emerald-400/30",
    text: "text-emerald-300",
    icon: "/images/sts2/icons/silent_energy_icon.webp",
  },
  "CHARACTER.DEFECT": {
    ko: "디펙트",
    ring: "ring-cyan-400/30",
    text: "text-cyan-300",
    icon: "/images/sts2/icons/defect_energy_icon.webp",
  },
  "CHARACTER.NECROBINDER": {
    ko: "네크로바인더",
    ring: "ring-pink-400/30",
    text: "text-pink-300",
    icon: "/images/sts2/icons/necrobinder_energy_icon.webp",
  },
  "CHARACTER.REGENT": {
    ko: "리젠트",
    ring: "ring-orange-400/30",
    text: "text-orange-300",
    icon: "/images/sts2/icons/regent_energy_icon.webp",
  },
};

const UNKNOWN_META = {
  ko: "?",
  ring: "ring-zinc-700",
  text: "text-zinc-300",
  icon: "/images/sts2/icons/star_icon.webp",
};

function isRunFile(file: File): boolean {
  return file.name.toLowerCase().endsWith(".run");
}

// Recursively flatten a dropped directory entry into a flat file list.
// Drop event gives us FileSystemEntry; folder traversal is the legacy
// webkit API (still the only thing supported in Safari/Firefox for drops).
async function readEntryFiles(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) {
    return new Promise<File[]>((resolve, reject) => {
      (entry as FileSystemFileEntry).file(
        (file) => resolve([file]),
        (err) => reject(err),
      );
    });
  }
  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const all: File[] = [];
    let batch: FileSystemEntry[] = [];
    do {
      batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
        reader.readEntries(
          (entries) => resolve(entries),
          (err) => reject(err),
        );
      });
      for (const child of batch) {
        const inner = await readEntryFiles(child);
        all.push(...inner);
      }
    } while (batch.length > 0);
    return all;
  }
  return [];
}

async function parseFiles(
  files: File[],
): Promise<{ runs: ParsedRun[]; errors: ParseError[] }> {
  const runFiles = files.filter(isRunFile);
  const runs: ParsedRun[] = [];
  const errors: ParseError[] = [];
  for (const file of runFiles) {
    try {
      const text = await file.text();
      const run = parseReplayRun(text);
      const hash = await computeRunHash(run);
      runs.push({
        fileName: file.name,
        raw: text,
        run,
        hash,
        slug: runRouteSlug(hash),
      });
    } catch (err) {
      errors.push({
        fileName: file.name,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
  runs.sort((a, b) => (b.run.start_time ?? 0) - (a.run.start_time ?? 0));
  return { runs, errors };
}

function formatDate(unix?: number): string {
  if (!unix) return "—";
  const d = new Date(unix * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

function formatRunTime(seconds?: number): string {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function characterShortKo(character?: string): string {
  if (!character) return "?";
  return CHARACTER_META[character]?.ko ?? "?";
}

export interface RunUploadZoneProps {
  // When set, overrides the default action (save to IDB + navigate to
  // /history-course/<slug>). Used by the dev replay PoC, which keeps
  // its own in-component state instead of routing.
  onPickRun?: (parsed: ParsedRun) => void | Promise<void>;
  // Override copy on the drop zone — defaults are tuned for landing.
  primaryLabel?: string;
}

export function RunUploadZone({
  onPickRun,
  primaryLabel,
}: RunUploadZoneProps = {}) {
  const router = useRouter();
  const [runs, setRuns] = useState<ParsedRun[]>([]);
  const [errors, setErrors] = useState<ParseError[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isPicking, setIsPicking] = useState<string | null>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setIsParsing(true);
    try {
      const result = await parseFiles(files);
      setRuns(result.runs);
      setErrors(result.errors);
    } finally {
      setIsParsing(false);
    }
  }, []);

  const onDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      const items = event.dataTransfer.items;
      const collected: File[] = [];
      if (items && items.length > 0 && "webkitGetAsEntry" in items[0]) {
        const entries = Array.from(items)
          .map((item) => item.webkitGetAsEntry())
          .filter((e): e is FileSystemEntry => !!e);
        for (const entry of entries) {
          try {
            const inner = await readEntryFiles(entry);
            collected.push(...inner);
          } catch {
            // ignore unreadable entries; user-visible errors come from parse step
          }
        }
      } else {
        collected.push(...Array.from(event.dataTransfer.files));
      }
      await handleFiles(collected);
    },
    [handleFiles],
  );

  const onInputChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files
        ? Array.from(event.target.files)
        : [];
      await handleFiles(files);
      // Reset so picking the same path twice fires change again.
      event.target.value = "";
    },
    [handleFiles],
  );

  const handlePick = useCallback(
    async (parsed: ParsedRun) => {
      setIsPicking(parsed.slug);
      try {
        if (onPickRun) {
          await onPickRun(parsed);
          return;
        }
        await saveRun({ runId: parsed.slug, raw: parsed.raw });
        router.push(`/history-course/${parsed.slug}`);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[history-course] pick failed", err);
        window.alert(
          `런을 저장하지 못했습니다: ${err instanceof Error ? err.message : String(err)}`,
        );
        setIsPicking(null);
      }
    },
    [onPickRun, router],
  );

  const hasResults = runs.length > 0 || errors.length > 0;

  return (
    <section className="space-y-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={cn(
          "relative rounded-2xl border-2 border-dashed px-6 py-10 text-center transition",
          isDragging
            ? "border-amber-300/70 bg-amber-300/5"
            : "border-zinc-700 bg-zinc-900/40 hover:border-zinc-600",
          hasResults && "py-6",
        )}
      >
        <div className="flex flex-col items-center gap-3">
          <Upload
            className={cn(
              "h-8 w-8",
              isDragging ? "text-amber-300" : "text-zinc-500",
            )}
            aria-hidden
          />
          <div>
            <p className="text-base font-semibold text-zinc-100">
              {hasResults
                ? "다른 폴더 또는 파일 올리기"
                : (primaryLabel ?? "내 런을 보려면 파일을 여기에")}
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-zinc-300">
                SlayTheSpire2/steam
              </code>{" "}
              폴더 통째로 드래그하거나 개별{" "}
              <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-zinc-300">
                .run
              </code>{" "}
              파일을 드롭하세요. 하위 폴더는 자동으로 뒤집니다. 본인 브라우저에서만
              처리됩니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => folderInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-100 ring-1 ring-zinc-700 hover:bg-zinc-700"
            >
              <FolderUp className="h-3.5 w-3.5" aria-hidden />
              폴더 선택
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-100 ring-1 ring-zinc-700 hover:bg-zinc-700"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden />
              파일 선택
            </button>
          </div>
          {isParsing && (
            <p className="flex items-center gap-1.5 text-xs text-zinc-400">
              <RefreshCw className="h-3 w-3 animate-spin" aria-hidden />
              읽는 중…
            </p>
          )}
        </div>
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error — non-standard but supported in Chromium/WebKit/Gecko
          webkitdirectory=""
          directory=""
          multiple
          className="hidden"
          onChange={onInputChange}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept=".run,application/json"
          multiple
          className="hidden"
          onChange={onInputChange}
        />
      </div>

      {errors.length > 0 && (
        <div className="rounded-lg bg-red-500/10 px-4 py-3 ring-1 ring-red-400/30">
          <div className="flex items-start gap-2">
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0 text-red-300"
              aria-hidden
            />
            <div className="text-xs text-red-200">
              <p className="font-semibold">
                읽지 못한 파일 {errors.length}개
              </p>
              <ul className="mt-1 space-y-0.5 text-red-300/80">
                {errors.slice(0, 5).map((err) => (
                  <li key={err.fileName} className="truncate">
                    <code className="font-mono">{err.fileName}</code>
                    {" — "}
                    {err.message}
                  </li>
                ))}
                {errors.length > 5 && (
                  <li className="text-red-400/60">… 외 {errors.length - 5}개</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {runs.length > 0 && (
        <div>
          <header className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-bold text-zinc-200">
              내 런{" "}
              <span className="text-zinc-500 font-medium">
                {runs.length}개 발견
              </span>
            </h2>
            <p className="text-[11px] text-zinc-500">
              v{MIN_SUPPORTED_BUILD.replace(/^v/, "")} 미만 빌드는 재현 정확도가
              낮아 비활성화됩니다.
            </p>
          </header>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {runs.map((p) => {
              const meta =
                CHARACTER_META[p.run.players[0]?.character ?? ""] ??
                UNKNOWN_META;
              const supported = isBuildSupported(p.run.build_id);
              const busy = isPicking === p.slug;
              return (
                <li key={`${p.run.seed}-${p.hash}`}>
                  <button
                    type="button"
                    onClick={() => handlePick(p)}
                    disabled={!supported || busy}
                    className={cn(
                      "group block w-full rounded-xl bg-zinc-900/60 p-3 text-left ring-1 ring-inset transition",
                      meta.ring,
                      supported && !busy
                        ? "hover:-translate-y-0.5 hover:ring-amber-300/40"
                        : "cursor-not-allowed opacity-50",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Image
                        src={meta.icon}
                        alt=""
                        width={32}
                        height={32}
                        className="h-8 w-8 shrink-0 object-contain"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={cn("text-xs font-bold", meta.text)}
                          >
                            {characterShortKo(p.run.players[0]?.character)}
                          </span>
                          <span
                            className={cn(
                              "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                              p.run.win
                                ? "bg-amber-500/15 text-amber-200"
                                : "bg-zinc-800 text-zinc-400",
                            )}
                          >
                            {p.run.win ? "정상" : "도중 사망"}
                          </span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-zinc-400">
                          <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-zinc-300">
                            {p.run.seed}
                          </code>
                          <span>승천 {p.run.ascension}</span>
                          <span className="text-zinc-600">·</span>
                          <span
                            className={
                              supported ? "text-zinc-400" : "text-red-300"
                            }
                          >
                            {p.run.build_id}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[10px] text-zinc-500">
                          <span>{formatDate(p.run.start_time)}</span>
                          <span className="text-zinc-700">·</span>
                          <span>{formatRunTime(p.run.run_time)}</span>
                          <span className="text-zinc-700">·</span>
                          <span>{p.run.acts.length}막</span>
                        </div>
                        {!supported && (
                          <p className="mt-1.5 text-[10px] text-red-300/80">
                            {MIN_SUPPORTED_BUILD} 미만 — 재현 미지원
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
