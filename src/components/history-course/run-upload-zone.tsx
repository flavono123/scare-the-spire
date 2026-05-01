"use client";

import { AlertCircle, FolderUp, RefreshCw, Upload } from "lucide-react";
import Image from "next/image";
import { useCallback, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { donateRun } from "@/lib/run-donation";
import { saveRun } from "@/lib/run-store";
import { isBuildSupported } from "@/lib/sts2-build-version";
import { computeRunHash, runRouteSlug } from "@/lib/sts2-run-hash";
import { parseReplayRun, type ReplayRun } from "@/lib/sts2-run-replay";
import { supabaseEnabled } from "@/lib/supabase";
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

function isRunFile(file: File): boolean {
  return file.name.toLowerCase().endsWith(".run");
}

// Recursively flatten a dropped directory entry into a flat file list.
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
  return { runs, errors };
}

export interface RunUploadZoneProps {
  // Fired after a batch of files has been parsed and stashed. The
  // parent uses this to bump a refreshKey for MyRunsList so the
  // newly-saved runs surface in the cards grid.
  onUploadComplete?: (count: number) => void;
}

export function RunUploadZone({ onUploadComplete }: RunUploadZoneProps = {}) {
  const { userId } = useAuth();
  const [errors, setErrors] = useState<ParseError[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [shareOnUpload, setShareOnUpload] = useState(false);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setIsParsing(true);
      try {
        const result = await parseFiles(files);
        let saved = 0;
        for (const parsed of result.runs) {
          if (!isBuildSupported(parsed.run.build_id)) continue;
          try {
            await saveRun({ runId: parsed.slug, raw: parsed.raw });
            saved += 1;
            if (shareOnUpload && supabaseEnabled && userId) {
              try {
                await donateRun({
                  runId: parsed.slug,
                  raw: parsed.raw,
                  run: parsed.run,
                  donorUserId: userId,
                });
              } catch {
                // donation failure shouldn't block the IDB save
              }
            }
          } catch {
            // ignore individual save failure
          }
        }
        setErrors(result.errors);
        if (saved > 0) onUploadComplete?.(saved);
      } finally {
        setIsParsing(false);
      }
    },
    [onUploadComplete, shareOnUpload, userId],
  );

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
            // ignore unreadable entries
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
      event.target.value = "";
    },
    [handleFiles],
  );

  return (
    <section className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={cn(
          "relative overflow-hidden rounded-2xl border-2 border-dashed px-6 py-10 transition",
          isDragging
            ? "border-amber-300/70 bg-amber-300/5"
            : "border-zinc-700 bg-zinc-900/40 hover:border-zinc-600",
        )}
      >
        {/* Background flair — flail knight peeking from the right edge,
            blurred and dimmed to read as background art rather than UI.
            top-[75%] shifts the figure downward so the face clears
            the top crop instead of just torso showing. */}
        <Image
          src="/images/sts2/monsters-render/flail_knight.webp"
          alt=""
          width={520}
          height={520}
          aria-hidden
          className="pointer-events-none absolute right-0 top-[75%] z-0 h-[180%] w-auto -translate-y-1/2 translate-x-[18%] opacity-25 blur-[2px]"
        />

        <div className="relative z-10 flex flex-col items-center gap-3 text-center">
          <Upload
            className={cn(
              "h-8 w-8",
              isDragging ? "text-amber-300" : "text-zinc-500",
            )}
            aria-hidden
          />
          <div>
            <p className="text-base font-semibold text-zinc-100">
              내 런을 보려면 파일을 여기에
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
          {supabaseEnabled && (
            <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] text-zinc-400 hover:text-zinc-200">
              <input
                type="checkbox"
                checked={shareOnUpload}
                onChange={(e) => setShareOnUpload(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-900 text-amber-500 focus:ring-amber-500"
              />
              올린 런 즉시 익명 공유
            </label>
          )}
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
    </section>
  );
}
