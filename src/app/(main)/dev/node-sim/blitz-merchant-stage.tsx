"use client";

/**
 * The Blitz merchant room on the 1920x1080 game screen (scenes/rooms/blitz_merchant_room.tscn and
 * the merchant inventory it instances), seen through a 9:16 camera: the stage shows `viewW` game px
 * of the screen's width at full height (zoom 1920/1080) and frames the hovered slot with its tip.
 */

import { useLayoutEffect, useRef, useState } from "react";
import type { BlitzMerchantResult, BlitzMerchantState, BlitzStateLayout } from "@/lib/node-sim/blitz-merchant";
import { BbcodeText, GameHoverTip, type HoverTipLayout } from "./game-hover-tip";
import { PlacedSpine, type PlacedSpineAsset, type SlotTransform, type SpineStatus } from "./placed-spine";

export const STAGE_W = 1080;
export const STAGE_H = 1920;
const SCREEN_W = 1920;
const SCREEN_H = 1080;

interface SpineAssetView extends PlacedSpineAsset {
  position?: number[];
  scale?: number[];
}

export interface BlitzMerchantLayoutView {
  room: {
    bgContainer: { offset: number[]; scale: number[] };
    bgLayerSize: number[];
    characterContainer: number[];
    merchantButton: { left: number; top: number };
    merchantVisual: { position: number[]; scale: number[]; skin: string; animation: string };
    tokens: { slot: string }[];
  };
  inventory: {
    backstopAlpha: number;
    rug: { left: number; top: number; right: number; bottom: number; openY: number; closedY: number };
    rugUrl: string;
    slots: number[][];
    selectionText: { anchor: number[]; left: number; top: number; right: number; bottom: number; outlineSize: number; color: number[]; outlineColor: number[] };
    hand: { position: number[]; scale: number[] };
    backButton: { left: number; top: number; right: number; bottom: number };
  };
  slot: { hitbox: { left: number; top: number; right: number; bottom: number }; shadow: { offset: number[]; modulate: number[] } };
  hoverTip: HoverTipLayout & { titleColor: number[]; descriptionColor: number[] };
}

export interface BlitzMerchantStageView {
  layout: BlitzMerchantLayoutView;
  background: string | null;
  spine: { merchant: SpineAssetView; hand: SpineAssetView; character: SpineAssetView | null };
  backButton: { image: string; arrow: string };
  options: { zoom: number; camera: number | null };
}

export function stateLayout(layout: BlitzMerchantLayoutView): BlitzStateLayout {
  const inv = layout.inventory;
  return {
    rugX: SCREEN_W / 2 + inv.rug.left,
    rugOpenY: inv.rug.openY,
    rugClosedY: inv.rug.closedY,
    backstopAlpha: inv.backstopAlpha,
    slots: inv.slots.map(([x, y]) => [x, y]),
    handStart: [inv.hand.position[0], inv.hand.position[1]],
    handOffset: [-48, 0],
    inventoryWidth: SCREEN_W,
  };
}

const rgba = (c: number[]) => `rgba(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)}, ${c[3] ?? 1})`;
const easeBackOut = (x: number) => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2;

/** Left edge (game px) of the camera window for this state. */
export function cameraX(view: BlitzMerchantStageView, result: BlitzMerchantResult, state: BlitzMerchantState, viewW: number): number {
  if (view.options.camera !== null) return view.options.camera;
  if (viewW >= SCREEN_W) return (SCREEN_W - viewW) / 2;
  const { layout } = view;
  const firstHover = result.beats.find((beat) => beat.action.do === "hover" && !beat.rejected)?.slot ?? 0;
  const slot = state.framed ?? (state.open || state.backstop > 0 ? firstHover : null);
  let center: number;
  if (slot === null) {
    const button = layout.room.merchantButton;
    center = SCREEN_W / 2 + (button.left + 566) / 2 + 0; // merchant button: offsets 215..566 from the center
  } else {
    const hit = layout.slot.hitbox;
    const ox = SCREEN_W / 2 + layout.inventory.rug.left + layout.inventory.slots[slot][0];
    const left = ox + hit.left * 1.1;
    const right = ox + hit.right * 1.1;
    const tipW = layout.hoverTip.width + 8;
    const align = result.stock[slot].tipAlign;
    const tipLeft = align === "right" ? ox + hit.right : ox + hit.left - layout.hoverTip.width;
    const span = [Math.min(left, tipLeft), Math.max(right, tipLeft + tipW)];
    if (span[1] - span[0] + 32 > viewW) return clamp(align === "right" ? tipLeft + tipW + 16 - viewW : tipLeft - 16, viewW);
    center = (span[0] + span[1]) / 2;
  }
  return clamp(center - viewW / 2, viewW);
}

function clamp(x: number, viewW: number) {
  return Math.max(0, Math.min(SCREEN_W - viewW, x));
}

export function BlitzMerchantStage({ view, result, state, pixelRatio, locale, onSpineStatus }: {
  view: BlitzMerchantStageView;
  result: BlitzMerchantResult;
  state: BlitzMerchantState;
  /** Device pixels per stage pixel. */
  pixelRatio: number;
  locale: "kor" | "eng";
  onSpineStatus: (id: string, status: SpineStatus) => void;
}) {
  const { layout } = view;
  const zoom = view.options.zoom;
  const viewW = STAGE_W / zoom;
  const viewH = STAGE_H / zoom;
  const camX = cameraX(view, result, state, viewW);
  const camY = (SCREEN_H - viewH) / 2;
  const gamePixelRatio = pixelRatio * zoom;
  const font = locale === "kor"
    ? { regular: "var(--font-gc-batang), serif", bold: "var(--font-gc-batang), serif" }
    : { regular: 'var(--font-kreon), "STS Kreon", serif', bold: 'var(--font-kreon), "STS Kreon", serif' };
  const [tokens, setTokens] = useState<Record<string, SlotTransform>>({});

  const room = layout.room;
  const inv = layout.inventory;
  const bgW = room.bgLayerSize[0] * room.bgContainer.scale[0];
  const bgH = room.bgLayerSize[1] * room.bgContainer.scale[1];
  const bgX = SCREEN_W / 2 + room.bgContainer.offset[0] - bgW / 2;
  const bgY = SCREEN_H / 2 + room.bgContainer.offset[1] - bgH / 2;
  const buttonX = SCREEN_W / 2 + room.merchantButton.left;
  const buttonY = SCREEN_H / 2 + room.merchantButton.top;
  const visualX = buttonX + room.merchantVisual.position[0];
  const visualY = buttonY + room.merchantVisual.position[1];
  const character = view.spine.character;
  const charX = SCREEN_W / 2 + room.characterContainer[0] + (character?.position?.[0] ?? 0);
  const charY = SCREEN_H / 2 + room.characterContainer[1] + (character?.position?.[1] ?? 0);
  const rugX = SCREEN_W / 2 + inv.rug.left;
  const rugW = inv.rug.right - inv.rug.left;
  const rugH = inv.rug.bottom - inv.rug.top;
  const hit = layout.slot.hitbox;
  const hand = view.spine.hand;
  const handScale = inv.hand.scale;
  // NBackButton: Enable() tweens to its show position (0.35 s Back Out) when the inventory opens.
  const openBeat = result.beats.find((beat) => beat.action.do === "open" && !beat.rejected && beat.start <= state.t);
  const backShow = result.input.startOpen ? 1 : openBeat ? easeBackOut(Math.min(1, (state.t - openBeat.start) / 350)) : 0;
  const closeBeat = [...result.beats].reverse().find((beat) => beat.action.do === "close" && !beat.rejected && beat.start <= state.t);
  const backHidden = closeBeat && (!openBeat || closeBeat.start > openBeat.start)
    ? 1 - Math.min(1, (state.t - closeBeat.start) / 350)
    : backShow;
  const backX = inv.backButton.left - 180 * (1 - backHidden);
  const backY = SCREEN_H + inv.backButton.top;

  const tipSlot = state.tipSlot;
  const tipRef = useRef<HTMLDivElement>(null);
  const tipOrigin = tipSlot === null ? null : {
    x: rugX + inv.slots[tipSlot][0] + (result.stock[tipSlot].tipAlign === "right" ? hit.right : hit.left - layout.hoverTip.width),
    y: inv.rug.openY + inv.slots[tipSlot][1] + hit.top,
  };
  // NHoverTipSet.CorrectVerticalOverflow: keep the tips above the screen's bottom edge.
  useLayoutEffect(() => {
    const node = tipRef.current;
    if (!node || !tipOrigin) return;
    const height = node.offsetHeight;
    node.style.top = `${Math.min(tipOrigin.y, SCREEN_H - height)}px`;
  });

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: "#000" }}>
      <div
        className="absolute left-0 top-0 overflow-hidden"
        style={{ width: SCREEN_W, height: SCREEN_H, transform: `scale(${zoom}) translate(${-camX}px, ${-camY}px)`, transformOrigin: "0 0" }}
      >
        {/* Room: the act's combat background in BgContainer (scale 1.5, 23 px right of center). */}
        {view.background && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={view.background} alt="" className="absolute" style={{ left: bgX, top: bgY, width: bgW, height: bgH, maxWidth: "none" }} />
        )}
        {character && (
          <PlacedSpine
            id="character"
            asset={character}
            animation="relaxed_loop"
            x={charX}
            y={charY}
            sx={character.scale?.[0] ?? 1}
            sy={character.scale?.[1] ?? 1}
            box={{ x: charX - 300, y: charY - 520, width: 600, height: 600 }}
            pixelRatio={gamePixelRatio}
            t={state.t}
            onStatus={onSpineStatus}
          />
        )}
        <PlacedSpine
          id="merchant"
          asset={view.spine.merchant}
          animation={room.merchantVisual.animation}
          skin={room.merchantVisual.skin}
          x={visualX}
          y={visualY}
          sx={room.merchantVisual.scale[0]}
          sy={room.merchantVisual.scale[1]}
          box={{ x: visualX - 500, y: visualY - 650, width: 900, height: 800 }}
          pixelRatio={gamePixelRatio}
          t={state.t}
          trackSlots={room.tokens.map((token) => token.slot)}
          onSlots={(slots) => {
            if (JSON.stringify(slots) !== JSON.stringify(tokens)) setTokens(slots);
          }}
          onStatus={onSpineStatus}
        />
        {/* NBlitzMerchantButton.UpdateTokens: slot i's small token while that entry is stocked. */}
        {result.stock.map((entry, i) => {
          const slot = tokens[room.tokens[i]?.slot];
          if (!slot || state.slots[i].status !== "available") return null;
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={entry.index}
              src={entry.tokenUrl}
              alt=""
              className="absolute"
              style={{
                left: slot.x,
                top: slot.y,
                transform: `translate(-50%, -50%) rotate(${slot.rotation}deg) scale(${slot.scaleX}, ${slot.scaleY})`,
                maxWidth: "none",
              }}
            />
          );
        })}

        {/* Inventory */}
        <div className="absolute inset-0" style={{ background: "#000", opacity: state.backstop }} />
        <div className="absolute" style={{ left: rugX, top: state.rugY, width: rugW, height: rugH }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={inv.rugUrl} alt="" className="absolute inset-0 h-full w-full" />
          {result.stock.map((entry, i) => {
            const slot = state.slots[i];
            const [ox, oy] = inv.slots[i];
            return (
              <div
                key={entry.index}
                className="absolute"
                style={{
                  left: ox,
                  top: oy,
                  transform: `scale(${slot.scale})`,
                  transformOrigin: "0 0",
                  filter: slot.status === "disabled" ? "brightness(0.6627)" : undefined,
                }}
                data-node-sim-slot={entry.type}
              >
                {slot.status !== "used" && (
                  <div className="absolute" style={{ left: hit.left, top: hit.top, width: hit.right - hit.left, height: hit.bottom - hit.top }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={entry.iconUrl}
                      alt=""
                      className="absolute"
                      style={{
                        left: layout.slot.shadow.offset[0],
                        top: layout.slot.shadow.offset[1],
                        width: hit.right - hit.left,
                        height: hit.bottom - hit.top,
                        filter: "brightness(0)",
                        opacity: layout.slot.shadow.modulate[3],
                      }}
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={entry.iconUrl} alt="" className="absolute inset-0 h-full w-full" />
                  </div>
                )}
              </div>
            );
          })}
          <SelectionText layout={inv.selectionText} rugW={rugW} rugH={rugH} text={result.selectionText(state.remaining)} font={font.regular} />
        </div>

        {backShow > 0 && (
          <div className="absolute" style={{ left: backX, top: backY, width: inv.backButton.right - inv.backButton.left, height: inv.backButton.bottom - inv.backButton.top }}>
            {/* back_button.tscn: Shadow (25% black, 1 px down), Image and its cream arrow Icon. */}
            <BackButtonImage src={view.backButton.image} rect={[-9, -1, 267, 150]} style={{ filter: "brightness(0)", opacity: 0.25098 }} />
            <BackButtonImage src={view.backButton.image} rect={[-21, -13, 267, 150]} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={view.backButton.arrow} alt="" className="absolute" style={{ left: -21 + 88, top: -13 + 28, width: 80, height: 80, objectFit: "contain" }} />
          </div>
        )}

        <PlacedSpine
          id="hand"
          asset={hand}
          animation="default"
          x={state.hand.x}
          y={state.hand.y}
          sx={handScale[0]}
          sy={handScale[1]}
          box={{ x: state.hand.x - 260, y: state.hand.y - 700, width: 520, height: 900 }}
          pixelRatio={gamePixelRatio}
          t={state.t}
          boneRotations={{ rotate_me: state.hand.rotation }}
          onStatus={onSpineStatus}
        />

        {tipSlot !== null && tipOrigin && (
          <div ref={tipRef} className="absolute flex flex-col" style={{ left: tipOrigin.x, top: tipOrigin.y, gap: layout.hoverTip.spacing }} data-node-sim-tip={result.stock[tipSlot].type}>
            {result.stock[tipSlot].tips.map((tip, i) => (
              <GameHoverTip key={i} tip={tip} layout={layout.hoverTip} font={font} colors={{ title: layout.hoverTip.titleColor, description: layout.hoverTip.descriptionColor }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BackButtonImage({ src, rect, style }: { src: string; rect: [number, number, number, number]; style?: React.CSSProperties }) {
  // TextureRect expand_mode 2, stretch_mode 5 (keep aspect, centered) in a rect grown by the scene's offsets.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="absolute" style={{ left: rect[0], top: rect[1], width: rect[2], height: rect[3], objectFit: "contain", ...style }} />
  );
}

function SelectionText({ layout, rugW, rugH, text, font }: {
  layout: BlitzMerchantLayoutView["inventory"]["selectionText"];
  rugW: number;
  rugH: number;
  text: string;
  font: string;
}) {
  const left = layout.anchor[0] * rugW + layout.left;
  const top = layout.anchor[1] * rugH + layout.top;
  const outline = layout.outlineSize;
  return (
    <div
      className="absolute flex items-center justify-center whitespace-nowrap"
      style={{
        left,
        top,
        width: layout.right - layout.left,
        height: layout.bottom - layout.top,
        fontFamily: font,
        // MegaRichTextLabel with AutoSizeEnabled off keeps the theme's normal_font_size (28).
        fontSize: 28,
        color: rgba(layout.color),
        WebkitTextStroke: `${outline}px ${rgba(layout.outlineColor)}`,
        paintOrder: "stroke fill",
      }}
    >
      <span><BbcodeText text={text} color={rgba(layout.color)} /></span>
    </div>
  );
}
