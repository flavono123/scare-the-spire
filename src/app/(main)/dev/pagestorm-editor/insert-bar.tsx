"use client";

import { useState, type ReactNode } from "react";
import {
  SAMPLE_ASSETS,
  SAMPLE_URL_PLACEHOLDER,
  resolvePastedUrl,
  type MockAlign,
  type MockGameAsset,
  type MockOgBookmark,
} from "./sample";

export function mockButtonClass(active?: boolean): string {
  return `rounded px-2 py-1 text-xs ${
    active
      ? "bg-primary/20 text-primary"
      : "text-muted-foreground hover:bg-muted hover:text-foreground"
  }`;
}

export function AlignButtons({
  value,
  onChange,
}: {
  value?: MockAlign;
  onChange: (align: MockAlign) => void;
}) {
  return (
    <>
      {(["left", "center", "right"] as const).map((align) => (
        <button
          key={align}
          type="button"
          className={mockButtonClass(value === align)}
          onClick={() => onChange(align)}
        >
          {align === "left" ? "좌" : align === "center" ? "중" : "우"}
        </button>
      ))}
    </>
  );
}

export function InsertBar({
  onInsertAsset,
  onInsertYoutube,
  onInsertOg,
}: {
  onInsertAsset: (asset: MockGameAsset) => void;
  onInsertYoutube: (videoId: string, title: string) => void;
  onInsertOg: (bookmark: MockOgBookmark) => void;
}) {
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2 border-b border-border px-3 py-2 sm:flex-row sm:items-center">
      <label className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground">
        <span className="shrink-0">게임 요소</span>
        <select
          className="min-w-0 flex-1 rounded border border-border bg-transparent px-2 py-1 text-foreground"
          defaultValue=""
          onChange={(event) => {
            const asset = SAMPLE_ASSETS.find((item) => item.id === event.target.value);
            if (asset) onInsertAsset(asset);
            event.currentTarget.value = "";
          }}
        >
          <option value="" disabled>
            본문에 이미지로 넣기
          </option>
          {SAMPLE_ASSETS.map((asset) => (
            <option key={`${asset.kind}:${asset.id}`} value={asset.id}>
              {asset.name} ({asset.kind})
            </option>
          ))}
        </select>
      </label>
      <form
        className="flex min-w-0 flex-[1.4] items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const resolved = resolvePastedUrl(url);
          if (!resolved) {
            setUrlError("유튜브 또는 http(s) URL만.");
            return;
          }
          setUrlError(null);
          if (resolved.kind === "youtube") {
            onInsertYoutube(resolved.videoId, resolved.title);
          } else {
            onInsertOg(resolved.bookmark);
          }
          setUrl("");
        }}
      >
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder={SAMPLE_URL_PLACEHOLDER}
          className="min-w-0 flex-1 rounded border border-border bg-transparent px-2 py-1 text-xs"
        />
        <button type="submit" className={mockButtonClass()}>
          URL 넣기
        </button>
      </form>
      {urlError ? <p className="text-xs text-red-400">{urlError}</p> : null}
    </div>
  );
}

export function MarkToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5">
      {children}
    </div>
  );
}
