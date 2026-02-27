"use client";

import type { Change } from "@/lib/types";

const REPORT_FORM_URL = "https://forms.gle/placeholder"; // TODO: replace with actual Google Form URL

function ReportButton({ change }: { change: Change }) {
  const prefill = `[${change.patch}] ${change.summary || change.entityId}`;
  const url = `${REPORT_FORM_URL}?entry.0=${encodeURIComponent(prefill)}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="mt-2 flex w-full items-center justify-center rounded py-1 text-xs font-medium bg-yellow-500/10 text-yellow-500 border border-yellow-500/30 hover:bg-yellow-500/20 transition-colors"
    >
      이야기 제보하기
    </a>
  );
}

export function ChangeList({ changes }: { changes: Change[] }) {
  return (
    <div className="relative pl-4">
      <div className="absolute left-1.5 top-1 bottom-1 w-px bg-border" />
      {changes.map((c) => {
        const baseDiffs = c.diffs.filter((d) => !d.upgraded);
        const upgradedDiffs = c.diffs.filter((d) => d.upgraded);

        return (
          <div key={c.id} className="relative mb-4 last:mb-0">
            <div className="absolute -left-2.5 top-1.5 h-2 w-2 rounded-full border-2 border-yellow-500 bg-background" />
            <div className="rounded border border-border bg-card/50 p-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium text-yellow-500">{c.patch}</span>
                {c.date && (
                  <span className="text-muted-foreground">{c.date}</span>
                )}
              </div>
              {c.summary && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {c.summary}
                </p>
              )}
              <div className="mt-1.5 space-y-0.5">
                {baseDiffs.map((d, i) => (
                  <div key={i} className="flex items-center gap-1 text-xs">
                    <span className="text-muted-foreground">
                      {d.displayName}:
                    </span>
                    <span className="text-red-400">{String(d.before)}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-green-400">{String(d.after)}</span>
                  </div>
                ))}
                {upgradedDiffs.length > 0 && (
                  <div className="mt-1 space-y-0.5 border-l-2 border-green-500/30 pl-2">
                    <span className="text-[10px] font-medium text-green-400/70">
                      +
                    </span>
                    {upgradedDiffs.map((d, i) => (
                      <div key={i} className="flex items-center gap-1 text-xs">
                        <span className="text-muted-foreground">
                          {d.displayName}:
                        </span>
                        <span className="text-red-400">
                          {String(d.before)}
                        </span>
                        <span className="text-muted-foreground">→</span>
                        <span className="text-green-400">
                          {String(d.after)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <ReportButton change={c} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
