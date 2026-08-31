"use client";

import { useCallback, useState } from "react";
import {
  GameAssetFigure,
  OgBookmarkFigure,
  YoutubePlayerFigure,
} from "./figures";
import { AlignButtons, InsertBar, MarkToolbar, mockButtonClass } from "./insert-bar";
import {
  SAMPLE_ASSETS,
  SAMPLE_YOUTUBE,
  type MockAlign,
  type MockGameAsset,
  type MockOgBookmark,
} from "./sample";
import "./pagestorm-mock-editor.css";

type VanillaBlock =
  | { id: string; type: "heading"; level: 2 | 3; text: string }
  | { id: string; type: "paragraph"; text: string; align: MockAlign }
  | { id: string; type: "quote"; text: string }
  | { id: string; type: "divider" }
  | { id: string; type: "asset"; asset: MockGameAsset; align: MockAlign }
  | { id: string; type: "youtube"; videoId: string; title: string; align: MockAlign }
  | { id: string; type: "og"; bookmark: MockOgBookmark; align: MockAlign };

function nid(): string {
  return `block-${Math.random().toString(36).slice(2, 10)}`;
}

function seedBlocks(): VanillaBlock[] {
  const asset = (id: string): VanillaBlock => {
    const found = SAMPLE_ASSETS.find((item) => item.id === id);
    if (!found) throw new Error(id);
    return { id: `asset-${id}`, type: "asset", asset: found, align: "center" };
  };
  return [
    { id: "h-synergy", type: "heading", level: 2, text: "다단히트 시너지" },
    {
      id: "p-lead",
      type: "paragraph",
      align: "left",
      text: "강철도 다단히트고 우주 먼지도 다단히트다. 그래서 케미컬 X · 우주 먼지 · 천원돌파에 동시에 잘 들어간다.",
    },
    asset("CHEMICAL_X"),
    asset("STARDUST"),
    asset("HEAVENLY_DRILL"),
    { id: "h-deck", type: "heading", level: 3, text: "덱 조작" },
    {
      id: "q-photon",
      type: "quote",
      text: "광자 베기로 뽑은 뒤 왕의 주먹을 다시 섞으면 다음 턴에도 뽑는다.",
    },
    { id: "hr-1", type: "divider" },
    {
      id: "yt-1",
      type: "youtube",
      videoId: SAMPLE_YOUTUBE.videoId,
      title: SAMPLE_YOUTUBE.title,
      align: "center",
    },
    {
      id: "og-1",
      type: "og",
      align: "left",
      bookmark: {
        url: "https://store.steampowered.com/app/2868840/Slay_the_Spire_2/",
        title: "Slay the Spire 2 on Steam",
        description: "The sequel to the world's most popular deckbuilder.",
        image: "/images/sts2/cards/pagestorm.webp",
        siteName: "Steam · mock OG snapshot",
      },
    },
  ];
}

function runMark(command: "bold" | "italic"): void {
  document.execCommand(command);
}

export function VanillaPagestormMock() {
  const [blocks, setBlocks] = useState<VanillaBlock[]>(seedBlocks);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const update = useCallback((id: string, patch: Partial<VanillaBlock>) => {
    setBlocks((current) =>
      current.map((block) => (block.id === id ? { ...block, ...patch } as VanillaBlock : block)),
    );
  }, []);

  const insertAfter = useCallback((block: VanillaBlock) => {
    setBlocks((current) => {
      const index = selectedId
        ? current.findIndex((item) => item.id === selectedId)
        : current.length - 1;
      const next = [...current];
      next.splice(index + 1, 0, block);
      return next;
    });
    setSelectedId(block.id);
  }, [selectedId]);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card/20">
      <MarkToolbar>
        <button type="button" className={mockButtonClass()} onClick={() => runMark("bold")}>
          B
        </button>
        <button type="button" className={mockButtonClass()} onClick={() => runMark("italic")}>
          I
        </button>
        <button
          type="button"
          className={mockButtonClass()}
          onClick={() => insertAfter({ id: nid(), type: "heading", level: 2, text: "제목" })}
        >
          H2
        </button>
        <button
          type="button"
          className={mockButtonClass()}
          onClick={() => insertAfter({ id: nid(), type: "heading", level: 3, text: "소제목" })}
        >
          H3
        </button>
        <button
          type="button"
          className={mockButtonClass()}
          onClick={() => insertAfter({ id: nid(), type: "quote", text: "인용" })}
        >
          인용
        </button>
        <button
          type="button"
          className={mockButtonClass()}
          onClick={() => insertAfter({ id: nid(), type: "divider" })}
        >
          구분선
        </button>
        <span className="px-2 text-[11px] text-muted-foreground">
          굵게/기울임은 document.execCommand
        </span>
      </MarkToolbar>
      <InsertBar
        onInsertAsset={(asset) => insertAfter({ id: nid(), type: "asset", asset, align: "center" })}
        onInsertYoutube={(videoId, title) =>
          insertAfter({ id: nid(), type: "youtube", videoId, title, align: "center" })}
        onInsertOg={(bookmark) => insertAfter({ id: nid(), type: "og", bookmark, align: "center" })}
      />
      <div className="pagestorm-mock-editor space-y-1">
        {blocks.map((block) => {
          const selected = block.id === selectedId;
          const frame = selected ? "rounded-md ring-1 ring-primary/60" : "";
          if (block.type === "heading") {
            const Tag = block.level === 2 ? "h2" : "h3";
            return (
              <Tag
                key={block.id}
                contentEditable
                suppressContentEditableWarning
                className={`outline-none ${frame}`}
                onFocus={() => setSelectedId(block.id)}
                onBlur={(event) => update(block.id, { text: event.currentTarget.textContent ?? "" })}
              >
                {block.text}
              </Tag>
            );
          }
          if (block.type === "paragraph") {
            return (
              <div key={block.id} className={frame}>
                <p
                  contentEditable
                  suppressContentEditableWarning
                  className="outline-none"
                  style={{ textAlign: block.align }}
                  onFocus={() => setSelectedId(block.id)}
                  onBlur={(event) =>
                    update(block.id, { text: event.currentTarget.textContent ?? "" })}
                >
                  {block.text}
                </p>
                <div className="flex justify-center gap-1">
                  <AlignButtons
                    value={block.align}
                    onChange={(align) => update(block.id, { align })}
                  />
                </div>
              </div>
            );
          }
          if (block.type === "quote") {
            return (
              <blockquote
                key={block.id}
                contentEditable
                suppressContentEditableWarning
                className={`outline-none ${frame}`}
                onFocus={() => setSelectedId(block.id)}
                onBlur={(event) => update(block.id, { text: event.currentTarget.textContent ?? "" })}
              >
                {block.text}
              </blockquote>
            );
          }
          if (block.type === "divider") {
            return (
              <hr
                key={block.id}
                className={frame}
                onClick={() => setSelectedId(block.id)}
              />
            );
          }
          if (block.type === "asset") {
            return (
              <div key={block.id} className={frame} onClick={() => setSelectedId(block.id)}>
                <GameAssetFigure asset={block.asset} align={block.align} />
                <div className="flex justify-center gap-1 pb-2">
                  <AlignButtons
                    value={block.align}
                    onChange={(align) => update(block.id, { align })}
                  />
                </div>
              </div>
            );
          }
          if (block.type === "youtube") {
            return (
              <div key={block.id} className={frame} onClick={() => setSelectedId(block.id)}>
                <YoutubePlayerFigure
                  videoId={block.videoId}
                  title={block.title}
                  align={block.align}
                />
                <div className="flex justify-center gap-1 pb-2">
                  <AlignButtons
                    value={block.align}
                    onChange={(align) => update(block.id, { align })}
                  />
                </div>
              </div>
            );
          }
          return (
            <div key={block.id} className={frame} onClick={() => setSelectedId(block.id)}>
              <OgBookmarkFigure bookmark={block.bookmark} align={block.align} />
              <div className="flex justify-center gap-1 pb-2">
                <AlignButtons
                  value={block.align}
                  onChange={(align) => update(block.id, { align })}
                />
              </div>
            </div>
          );
        })}
        <button
          type="button"
          className={`${mockButtonClass()} mt-2`}
          onClick={() =>
            insertAfter({ id: nid(), type: "paragraph", text: "", align: "left" })}
        >
          문단 추가
        </button>
      </div>
    </div>
  );
}
