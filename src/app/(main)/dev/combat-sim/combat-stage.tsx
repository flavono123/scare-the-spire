"use client";

import { memo, useMemo, type CSSProperties } from "react";
import { CardTile } from "@/components/codex/card-tile";
import type { CodexCard } from "@/lib/codex-types";
import { effectiveCard } from "@/lib/combat-sim/engine";
import { nextRandom, seedRandom } from "@/lib/combat-sim/rng";
import type { CombatTimeline, TimelineBeat } from "@/lib/combat-sim/timeline";
import type { SimCreature, SimResult, SimState } from "@/lib/combat-sim/types";
import { gameStroke, TEXT_CREAM } from "@/lib/sts2-card-style";
import { substituteAmount } from "@/lib/sts2-enchant-rules";
import { SpineActor, type ActorStatus, type SpineCue, type SpineViewport } from "./spine-actor";
import { buildMotion, evaluateTrack, flyPositionAt, pileViews, type CardVisual, type PileView } from "./card-motion";
import { clamp01, ease, rgba } from "./godot-anim";
import {
  CARD_H,
  CARD_W,
  ORB,
  PILES,
  PILE_SIZE,
  STAGE_H,
  STAGE_W,
  UI_SCALE,
  commitTime,
  monsterBoxes,
  orbBaseAngle,
  playerBox,
  sceneFrame,
  visibleState,
  type CreatureBox,
} from "./stage-layout";
import { CardTrailLayer, EnergyGainLayerCanvas, PreloadImages, type EnergyGainVfx } from "./vfx-layer";
import type { CombatSimMonsterView, CombatSimView, EnergyCounterAsset } from "./view-types";
import { SimClock, WeightedOverlay } from "./weighted-overlay";

const KREON = 'var(--font-kreon), "STS Kreon", serif';
// StsColors (archive src/.../StsColors.cs)
const STS_RED = "#FF5555";
const STS_GOLD = "#EFC851";
const UNPLAYABLE_COST_OUTLINE = "#501717";

interface CombatStageProps {
  view: CombatSimView;
  result: SimResult;
  timeline: CombatTimeline;
  t: number;
  /** Device pixels per stage pixel (frame scale x devicePixelRatio). */
  pixelRatio: number;
  badges: boolean;
  onActorStatus: (id: string, status: ActorStatus) => void;
}

export function CombatStage({ view, result, timeline, t, pixelRatio, badges, onActorStatus }: CombatStageProps) {
  const frame = timeline.frameAt(t);
  const visible = visibleState(frame.beat, frame.progress, frame.state);
  const recent = timeline.beatsUntil(t);
  const withPlayer = view.parts.includes("player") && view.character !== null;
  const withCards = view.parts.includes("cards") && view.character !== null;
  const sceneLayout = sceneFrame(withPlayer, withCards);
  const player = playerBox(sceneLayout);
  const monsters = useMemo(
    () => monsterBoxes(view.monsters, view.combatLayout, sceneFrame(withPlayer, withCards)),
    [view.monsters, view.combatLayout, withPlayer, withCards],
  );
  const cues = useMemo(() => animationCues(timeline, view), [timeline, view]);
  const motion = useMemo(() => buildMotion(result, timeline), [result, timeline]);
  const glows = useMemo(() => playableGlowModel(result, timeline, view), [result, timeline, view]);
  const energyGains = useMemo(
    () => timeline.beats.filter((beat) => beat.event.kind === "energy" && beat.event.to > beat.event.from).map((beat) => beat.start),
    [timeline],
  );
  const visuals = motion.tracks.map((track) => evaluateTrack(track, t));
  const piles = pileViews(motion, t);
  const flights = visuals
    .filter((visual) => visual.fly && visual.visible)
    .map((visual) => {
      const fly = visual.fly!;
      return { visual, seed: fly.seed, positionAt: (age: number) => flyPositionAt(fly.from, fly.to, fly.seed, age) };
    });
  const trail = view.cardTrail;

  return (
    <SimClock.Provider value={t}>
    <div className="absolute left-0 top-0 overflow-hidden" style={{ width: STAGE_W, height: STAGE_H, background: "#0b0b0f" }} data-game-locale="kor">
      <PreloadImages
        urls={[
          ...(trail ? [trail.outer.texture, trail.inner.texture, trail.bigSparks?.texture, trail.littleSparks?.texture, ...trail.sprites.map((sprite) => sprite.texture)] : []),
          ...(view.energyGainVfx?.layers.map((layer) => layer.texture) ?? []),
        ]}
      />
      <Background url={view.background} height={sceneLayout.backgroundHeight} />

      {withPlayer && view.character && (
        <Creature
          id="player"
          box={player}
          creature={visible.player}
          spine={view.character.spine}
          imageUrl={view.character.imageUrl}
          cues={cues.player ?? []}
          t={t}
          pixelRatio={pixelRatio}
          viewport={null}
          view={view}
          timeline={timeline}
          barWidth={player.width}
          onActorStatus={onActorStatus}
        />
      )}
      {view.monsters.map((monster, index) => {
        const state = visible.monsters[index];
        if (!state) return null;
        const box = monsters[index];
        return (
          <Creature
            key={`m${index}`}
            id={`m${index}`}
            box={box}
            creature={state}
            spine={monster.spine}
            imageUrl={monster.staticArt ? (state.moveId ? monster.staticArt.byMove[state.moveId] : null) ?? monster.staticArt.defaultImage : monster.imageUrl}
            cues={cues[`m${index}`] ?? []}
            t={t}
            pixelRatio={pixelRatio}
            viewport={monster.layout ? viewportFromLayout(monster.layout) : null}
            view={view}
            timeline={timeline}
            // NCreature: monster bars are the bounds width + 24 (HpBarSizeReduction); without bounds, the scene's 250.
            barWidth={monster.layout ? (monster.layout.bounds.width + 24) * box.scale : 250 * box.scale}
            onActorStatus={onActorStatus}
          >
            <Intent view={view} monster={monster} moveId={state.moveId} box={box} t={t} />
          </Creature>
        );
      })}

      {withCards && view.character?.energyCounter && (
        <EnergyOrb
          asset={view.character.energyCounter}
          energy={visible.energy}
          maxEnergy={visible.maxEnergy}
          angle={orbBaseAngle(timeline, result.start.energy, t)}
          gains={energyGains}
          vfx={view.energyGainVfx}
          t={t}
          pixelRatio={pixelRatio}
        />
      )}
      {withCards && (
        <>
          <Piles view={view} piles={piles} />
          {visuals.map((visual) => (
            <CardView
              key={visual.uid}
              visual={visual}
              view={view}
              state={visible}
              glow={glowAt(glows[visual.uid], t)}
            />
          ))}
          <CardTrailLayer flights={flights} trail={trail} pixelRatio={pixelRatio} />
        </>
      )}

      <DamageNumbers timeline={timeline} t={t} player={withPlayer ? player : null} monsters={monsters} />
      {badges && <Badges beats={recent} t={t} />}
    </div>
    </SimClock.Provider>
  );
}

function Background({ url, height }: { url: string | null; height: number }) {
  if (!url) return null;
  return (
    <div className="absolute left-0 top-0" style={{ width: STAGE_W, height }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="h-full w-full object-cover" style={{ objectPosition: "50% 60%" }} />
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(to bottom, rgba(11,11,15,0.55) 0%, rgba(11,11,15,0) 18%, rgba(11,11,15,0) 70%, #0b0b0f 100%)" }}
      />
    </div>
  );
}

function viewportFromLayout(layout: NonNullable<CombatSimMonsterView["layout"]>): SpineViewport | null {
  // Same transform as EncounterSceneStage: undo the Visuals node so the box shows the game's bounds.
  const scaleX = Math.abs(layout.visualScale.x);
  const scaleY = Math.abs(layout.visualScale.y);
  if (scaleX === 0 || scaleY === 0) return null;
  const x = layout.visualScale.x > 0
    ? (layout.bounds.left - layout.visualPosition.x) / scaleX
    : (layout.visualPosition.x - layout.bounds.right) / scaleX;
  return { x, y: (layout.visualPosition.y - layout.bounds.bottom) / scaleY, width: layout.bounds.width / scaleX, height: layout.bounds.height / scaleY };
}

function animationCues(timeline: CombatTimeline, view: CombatSimView): Record<string, SpineCue[]> {
  const cues: Record<string, SpineCue[]> = {};
  for (const beat of timeline.beats) {
    if (beat.event.kind !== "animate") continue;
    const { creature, animation } = beat.event;
    const asset = creature === "player" ? view.character?.spine : view.monsters[Number(creature.slice(1))]?.spine;
    const key = animation === "attack" ? "ATTACK" : animation === "hurt" ? "HURT" : "CAST";
    const name = asset?.moveAnimations?.[key]?.[0] ?? animation;
    (cues[creature] ??= []).push({ t: beat.start, animation: name });
  }
  return cues;
}

interface CreatureProps {
  id: string;
  box: CreatureBox;
  creature: SimCreature;
  spine: NonNullable<CombatSimView["character"]>["spine"] | CombatSimMonsterView["spine"];
  imageUrl: string | null;
  cues: SpineCue[];
  t: number;
  pixelRatio: number;
  viewport: SpineViewport | null;
  view: CombatSimView;
  timeline: CombatTimeline;
  /** Health bar width in stage px. */
  barWidth: number;
  onActorStatus: (id: string, status: ActorStatus) => void;
  children?: React.ReactNode;
}

function Creature({ id, box, creature, spine, imageUrl, cues, t, pixelRatio, viewport, view, timeline, barWidth, onActorStatus, children }: CreatureProps) {
  const left = box.x - box.width / 2;
  const top = box.y - box.height;
  return (
    <>
      <div className="absolute" style={{ left, top, width: box.width, height: box.height, zIndex: 10 }} data-combat-sim-creature={id}>
        {spine ? (
          <SpineActor
            id={id}
            asset={spine}
            width={box.width}
            height={box.height}
            pixelRatio={pixelRatio}
            viewport={viewport}
            t={t}
            cues={cues}
            onStatus={onActorStatus}
          />
        ) : imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="h-full w-full object-contain" style={{ objectPosition: "50% 100%" }} />
        ) : null}
      </div>
      {children}
      <HealthBar id={id} creature={creature} box={box} width={barWidth} view={view} timeline={timeline} t={t} />
    </>
  );
}

/** A NinePatchRect with horizontal margins only, multiplied by `color` (Godot modulate). */
function NinePatch({ url, texture, margin, x, y, width, height, scale, color }: {
  url: string;
  texture: { width: number; height: number };
  margin: number;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Stage px per texture px horizontally (caps). */
  scale: number;
  color: number[];
}) {
  const cap = margin * scale;
  const middle = Math.max(0, width - 2 * cap);
  const stretch = middle / Math.max(1, texture.width - 2 * margin);
  const piece = (left: number, pieceWidth: number, sizeX: number, positionX: number) => ({
    position: "absolute" as const,
    left,
    top: 0,
    width: pieceWidth,
    height,
    backgroundImage: `url(${url})`,
    backgroundSize: `${sizeX}px ${height}px`,
    backgroundPosition: `${positionX}px 0`,
    backgroundColor: rgba(color.slice(0, 3)),
    backgroundBlendMode: "multiply" as const,
    WebkitMaskImage: `url(${url})`,
    WebkitMaskSize: `${sizeX}px ${height}px`,
    WebkitMaskPosition: `${positionX}px 0`,
    WebkitMaskRepeat: "no-repeat",
    backgroundRepeat: "no-repeat",
  });
  return (
    <div className="absolute" style={{ left: x, top: y, width, height, opacity: color[3] ?? 1 }}>
      <div style={piece(0, cap, texture.width * scale, 0)} />
      <div style={piece(cap, middle, texture.width * stretch, -margin * stretch)} />
      <div style={piece(cap + middle, cap, texture.width * scale, -(texture.width - margin) * scale)} />
    </div>
  );
}

// health_bar.tscn / NHealthBar (0.102.0)
const HP_BAR = {
  height: 16,
  background: [0.164706, 0.376471, 0.419608, 0.752941],
  blockOutline: [0.705882, 0.886275, 1, 1],
  foreground: [0.945, 0.216, 0.243, 1], // #F1373E
  foregroundBlocked: [0.231, 0.435, 0.639, 1], // #3B6FA3
  middleground: [1, 0.498039, 0, 1],
  labelOutline: "#900000",
  labelOutlineBlocked: "#1B3045",
};

function HealthBar({ id, creature, box, width, view, timeline, t }: {
  id: string;
  creature: SimCreature;
  box: CreatureBox;
  width: number;
  view: CombatSimView;
  timeline: CombatTimeline;
  t: number;
}) {
  // Width follows the creature's bounds; height, fonts and icons are fixed UI sizes.
  const k = UI_SCALE;
  const height = HP_BAR.height * k;
  const left = box.x - width / 2;
  // The bar's top sits 7 px below the creature's origin (its feet).
  const top = box.y + 7 * k;
  const hasBlock = creature.block > 0;
  const inner = width - 10 * k;
  const fill = (hp: number) => (creature.maxHp > 0 ? Math.max((hp / creature.maxHp) * inner, 12 * k) : 0);
  // HpMiddleground: after damage it holds 1.0 s, then follows the foreground over 1.0 s (Expo Out).
  let lag = fill(creature.hp);
  for (const beat of timeline.beats) {
    if (beat.event.kind !== "damage" || beat.event.creature !== id) continue;
    const at = commitTime(beat);
    if (at > t) break;
    const since = (t - at) / 1000;
    if (since < 2 && beat.event.hpTo < beat.event.hpFrom) {
      const from = fill(beat.event.hpFrom) + k;
      const to = fill(beat.event.hpTo) - 2 * k;
      lag = since < 1 ? from : from + (to - from) * ease.expoOut(since - 1);
    }
  }
  const blockSince = blockAppearSince(timeline, id, t);
  return (
    <div className="absolute" style={{ left, top, width, height, zIndex: 30 }} data-combat-sim-health={id}>
      <NinePatch url={view.ui.health_bar_bg} texture={{ width: 20, height: 16 }} margin={9} x={k} y={0} width={width - 2 * k} height={height} scale={k} color={HP_BAR.background} />
      {hasBlock && (
        <NinePatch url={view.ui.health_bar_stroke} texture={{ width: 22, height: 16 }} margin={9} x={k} y={0} width={width - 2 * k} height={height} scale={k} color={HP_BAR.blockOutline} />
      )}
      {/* HpForegroundContainer (5, 3) inset, clipped by the health_bar.png mask (margins 6). */}
      <div
        className="absolute"
        style={{
          left: 5 * k,
          top: 3 * k,
          width: inner,
          height: 10 * k,
          // 12 px texture with 6 px margins has no center slice; CSS would mask the middle out, so keep a 1 px center.
          WebkitMaskBoxImage: `url(${view.ui.health_bar}) 0 5 0 6 fill / 0 ${5 * k}px 0 ${6 * k}px stretch`,
        }}
      >
        <NinePatch url={view.ui.health_bar_fill} texture={{ width: 15, height: 16 }} margin={6} x={0} y={-4 * k} width={Math.max(lag, 0)} height={18 * k} scale={k} color={HP_BAR.middleground} />
        <NinePatch
          url={view.ui.health_bar_fill}
          texture={{ width: 15, height: 16 }}
          margin={6}
          x={0}
          y={-4 * k}
          width={fill(creature.hp)}
          height={18 * k}
          scale={k}
          color={hasBlock ? HP_BAR.foregroundBlocked : HP_BAR.foreground}
        />
      </div>
      {/* HpLabel: kreon_bold_glyph_space_one, 24, outline 16, shadow (6, 4) rgba(0,0,0,0.25). */}
      <div
        className="absolute flex items-center justify-center"
        style={{
          left: 0,
          right: 0,
          top: -7 * k,
          height: 31 * k,
          fontFamily: KREON,
          fontWeight: 700,
          fontSize: 24 * k,
          letterSpacing: k,
          color: TEXT_CREAM,
          ...outline(hasBlock ? HP_BAR.labelOutlineBlocked : HP_BAR.labelOutline, 16 * k * 0.5),
          textShadow: `${6 * k}px ${4 * k}px 0 rgba(0,0,0,0.25)`,
        }}
      >
        {creature.hp}/{creature.maxHp}
      </div>
      {hasBlock && (
        <div
          className="absolute flex items-center justify-center"
          style={{
            // BlockContainer 60x60 centered on the bar's left end, y -26..34.
            left: -36 * k,
            top: (-26 + (1 - ease.backOut(clamp01(blockSince / 0.5))) * -20) * k,
            width: 60 * k,
            height: 60 * k,
            opacity: ease.sineOut(clamp01(blockSince / 0.5)),
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={view.ui.block} alt="" className="absolute inset-0 h-full w-full" />
          <span
            className="relative"
            style={{
              fontFamily: KREON,
              fontWeight: 700,
              fontSize: 24 * k,
              color: TEXT_CREAM,
              ...outline("rgb(11, 85, 107)", 14 * k * 0.5),
              filter: `drop-shadow(${4 * k}px ${4 * k}px 0 rgba(0,0,0,0.25))`,
            }}
          >
            {creature.block}
          </span>
        </div>
      )}
      <PowerRow creature={creature} view={view} scale={k} />
    </div>
  );
}

/** Seconds since this creature's block last rose from 0 (Infinity if it never did). */
function blockAppearSince(timeline: CombatTimeline, id: string, t: number): number {
  let since = Infinity;
  for (const beat of timeline.beats) {
    if (beat.start > t) break;
    const before = id === "player" ? beat.before.player : beat.before.monsters.find((monster) => monster.key === id);
    const after = id === "player" ? beat.after.player : beat.after.monsters.find((monster) => monster.key === id);
    if (before && after && before.block === 0 && after.block > 0) since = (t - beat.start) / 1000;
  }
  return since;
}

function PowerRow({ creature, view, scale }: { creature: SimCreature; view: CombatSimView; scale: number }) {
  if (creature.powers.length === 0) return null;
  const size = 36 * scale;
  return (
    <div className="absolute flex flex-wrap" style={{ left: 0, top: 22 * scale, gap: 4 * scale }}>
      {creature.powers.map((power) => (
        <div key={power.id} className="relative" style={{ width: size, height: size }} title={view.catalog.powers[power.id]?.name ?? power.id}>
          {view.powerIcons[power.id] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={view.powerIcons[power.id]!} alt="" className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-full bg-zinc-800 text-xs text-zinc-200">{power.id.slice(0, 3)}</div>
          )}
          {power.amount !== 1 && (
            <span className="absolute -bottom-1 -right-1" style={{ fontFamily: KREON, fontWeight: 700, fontSize: 18 * scale, color: TEXT_CREAM, ...outline("#000", 4 * scale) }}>
              {power.amount}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

const INTENT_ICONS: Record<string, string> = {
  BuffIntent: "buff",
  DebuffIntent: "debuff",
  DebuffStrongIntent: "debuff",
  DefendIntent: "defend",
  SummonIntent: "summon",
  StatusIntent: "status_card",
  CardDebuffIntent: "card_debuff",
  HealIntent: "heal",
  StunIntent: "stun",
  SleepIntent: "sleep",
  EscapeIntent: "escape",
  DeathBlowIntent: "death_blow",
  HiddenIntent: "hidden",
};

/** monster-detail.tsx getAttackIntentIcon: tier by total damage. */
function attackIcon(total: number): string {
  const tier = total < 5 ? 1 : total < 10 ? 2 : total < 20 ? 3 : total < 40 ? 4 : 5;
  return `attack_${tier}`;
}

function Intent({ view, monster, moveId, box, t }: { view: CombatSimView; monster: CombatSimMonsterView; moveId: string | null; box: CreatureBox; t: number }) {
  const move = moveId ? view.catalog.monsters[monster.id]?.moves[moveId] : null;
  if (!move) return null;
  const bob = Math.sin((t / 1000) * Math.PI) * 6;
  return (
    <div
      className="absolute flex items-end justify-center gap-1"
      style={{ left: box.x - 200, width: 400, top: box.y - box.height - 76 + bob, zIndex: 35 }}
      data-combat-sim-intent={moveId}
    >
      {move.intents.map((intent, index) => {
        const isAttack = intent.damage !== undefined && (intent.type === "SingleAttackIntent" || intent.type === "MultiAttackIntent");
        const repeat = intent.repeat ?? 1;
        const icon = isAttack ? attackIcon((intent.damage ?? 0) * repeat) : INTENT_ICONS[intent.type] ?? "unknown";
        return (
          <div key={`${intent.type}-${index}`} className="relative" style={{ width: 64, height: 64 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/images/sts2/intents/${icon}.png`} alt="" className="h-full w-full object-contain" />
            {isAttack && (
              <span
                className="absolute bottom-[-6px] left-0 whitespace-nowrap"
                style={{ fontFamily: KREON, fontWeight: 700, fontSize: 32, color: TEXT_CREAM, ...outline("#000", 8) }}
              >
                {intent.damage}{repeat > 1 ? `×${repeat}` : ""}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function outline(color: string, width: number): CSSProperties {
  return { WebkitTextStroke: `${width}px ${color}`, paintOrder: "stroke fill" };
}

const ENERGY_VFX_BOX = 560;

/**
 * NEnergyCounter: the scene's layers, rotation layers turning, darkened at 0
 * (energy_orb_dark: hsv s0.5 v0.85, Layers modulate DarkGray). Spending energy
 * only refreshes the label; a gain restarts the back and front VFX.
 */
function EnergyOrb({ asset, energy, maxEnergy, angle, gains, vfx, t, pixelRatio }: {
  asset: EnergyCounterAsset;
  energy: number;
  maxEnergy: number;
  angle: number;
  gains: number[];
  vfx: EnergyGainVfx | null;
  t: number;
  pixelRatio: number;
}) {
  const scale = ORB.size / asset.size;
  const empty = energy === 0;
  const label = asset.label;
  const vfxOffset = (ORB.size - ENERGY_VFX_BOX) / 2;
  return (
    <div
      className="absolute"
      style={{ left: ORB.x - ORB.size / 2, top: ORB.y - ORB.size / 2, width: ORB.size, height: ORB.size, zIndex: 60 }}
      data-combat-sim-energy={`${energy}/${maxEnergy}`}
    >
      <div className="absolute" style={{ left: vfxOffset, top: vfxOffset }}>
        <EnergyGainLayerCanvas vfx={vfx} side="back" gains={gains} t={t} size={ENERGY_VFX_BOX} pixelRatio={pixelRatio} />
      </div>
      <div className="absolute inset-0" style={{ filter: empty ? "saturate(0.5) brightness(0.563)" : undefined }}>
        {asset.layers.map((layer) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={layer.name}
            src={layer.url}
            alt=""
            className="absolute inset-0 h-full w-full object-contain"
            style={layer.rotationIndex === null ? undefined : { transform: `rotate(${(angle * (layer.rotationIndex + 1)) % 360}deg)` }}
          />
        ))}
      </div>
      <div className="absolute" style={{ left: vfxOffset, top: vfxOffset }}>
        <EnergyGainLayerCanvas vfx={vfx} side="front" gains={gains} t={t} size={ENERGY_VFX_BOX} pixelRatio={pixelRatio} />
      </div>
      {/* Label: kreon_bold_shared with spacing_glyph 2, size 36, outline 16, shadow (3, 2) with shadow outline 16. */}
      <div
        className="absolute flex items-center justify-center"
        style={{
          left: 16 * scale,
          right: 16 * scale,
          top: 35 * scale,
          bottom: 35 * scale,
          fontFamily: KREON,
          fontWeight: 700,
          fontSize: label.fontSize * scale,
          letterSpacing: 2 * scale,
          color: empty ? STS_RED : label.fontColor,
          ...outline(empty ? UNPLAYABLE_COST_OUTLINE : label.outlineColor, label.outlineSize * scale * 0.5),
          filter: `drop-shadow(${label.shadowOffset[0] * scale}px ${label.shadowOffset[1] * scale}px 0 ${label.shadowColor})`,
        }}
      >
        {energy}/{maxEnergy}
      </div>
    </div>
  );
}

/**
 * Pile buttons (draw_pile / discard_pile / exhaust_pile .tscn): 80x80 icon,
 * 48x48 count badge (bottom-right for draw, bottom-left for discard), count in
 * Kreon Bold 26 with a 12 outline. A card arriving bumps icon and count.
 */
function Piles({ view, piles }: { view: CombatSimView; piles: Record<"draw" | "discard" | "exhaust", PileView> }) {
  const k = UI_SCALE;
  const button = (key: "draw" | "discard" | "exhaust", icon: string | undefined, outlineColor: string, badge: { x: number; y: number } | null) => {
    const pile = piles[key];
    if (key === "exhaust" && pile.count === 0) return null;
    const position = PILES[key];
    return (
      <div
        className="absolute"
        style={{ left: position.x - PILE_SIZE / 2, top: position.y - PILE_SIZE / 2, width: PILE_SIZE, height: PILE_SIZE, zIndex: 60 }}
        data-combat-sim-pile={key}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {icon && <img src={icon} alt="" className="h-full w-full object-contain" style={{ transform: `scale(${pile.bump})` }} />}
        <div
          className="absolute flex items-center justify-center"
          style={{
            left: (badge?.x ?? 16) * k,
            top: (badge?.y ?? 16) * k,
            width: 48 * k,
            height: 48 * k,
            transform: `scale(${pile.bump})`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {badge && view.ui.pile_button_count && <img src={view.ui.pile_button_count} alt="" className="absolute inset-0 h-full w-full" />}
          <span
            className="relative"
            style={{
              fontFamily: KREON,
              fontWeight: 700,
              fontSize: 26 * k,
              letterSpacing: k,
              color: TEXT_CREAM,
              ...outline(outlineColor, 12 * k * 0.5),
              filter: `drop-shadow(${2 * k}px ${k}px 0 rgba(0,0,0,0.125))`,
            }}
          >
            {pile.count}
          </span>
        </div>
      </div>
    );
  };
  return (
    <>
      {button("draw", view.ui.draw_pile, "#881f20", { x: 48, y: 36 })}
      {button("discard", view.ui.discard_pile, "#881f20", { x: -17.5, y: 36.5 })}
      {button("exhaust", view.ui.exhaust_pile, "#341f2f", null)}
    </>
  );
}

interface CardViewProps {
  visual: CardVisual;
  view: CombatSimView;
  state: SimState;
  /** NCardHighlight width fraction (0..1 of 0.075). */
  glow: number;
}

function CardView({ visual, view, state, glow }: CardViewProps) {
  const card = state.cards[visual.uid] ?? null;
  const def = card ? view.catalog.cards[card.id] : null;
  const entity = card ? view.cards[card.id] : null;
  const cost = def && card ? effectiveCard(def, card.upgraded).cost : 0;
  const inHand = state.piles.hand.includes(visual.uid);
  const unplayable = Boolean(inHand && def && !def.isXCost && cost > state.energy);
  const affliction = card?.affliction ?? null;
  const suffix = affliction ? view.catalog.afflictions[affliction.id]?.extraCardText ?? null : null;
  if (!card || !entity) return null;
  const { pose } = visual;
  const shown = visual.visible && visual.alpha > 0.01 && pose.scale > 0.001;
  const z = visual.fly ? 460 : visual.lifted ? 400 : inHand ? 100 + state.piles.hand.indexOf(visual.uid) : 50;
  return (
    <div
      className="absolute left-0 top-0"
      data-combat-sim-card={visual.uid}
      style={{
        width: CARD_W,
        height: CARD_H,
        transform: `translate(${pose.x - CARD_W / 2}px, ${pose.y - CARD_H / 2}px) rotate(${pose.rotate}deg) scale(${pose.scale})`,
        opacity: visual.alpha,
        zIndex: z,
        visibility: shown ? "visible" : "hidden",
        filter: visual.tint < 1 ? `brightness(${visual.tint})` : undefined,
      }}
    >
      {glow > 0.001 && <CardHighlight glow={glow} />}
      <MemoCard
        card={entity}
        upgraded={card.upgraded}
        cost={cost}
        unplayable={unplayable}
        suffix={suffix && affliction ? substituteAmount(suffix, affliction.amount, { asEnergyIcon: true }) : null}
        weighted={affliction?.id === "WEIGHTED" && shown}
      />
    </div>
  );
}

/**
 * NCardHighlight (card.tscn Highlight): an additive band along the card frame
 * SDF, Color(0, 0.957, 0.988, 0.98), shader width 0.075 when playable. The SDF
 * texture and its slow ripple are not ported; this is a soft band outside the
 * card edge drawn behind the card, like the node.
 */
function CardHighlight({ glow }: { glow: number }) {
  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{
        borderRadius: CARD_W * 0.06,
        boxShadow: `0 0 ${10 * glow}px ${7 * glow}px rgba(0, 244, 252, ${0.98 * glow})`,
        mixBlendMode: "plus-lighter",
      }}
    />
  );
}

interface GlowChange {
  t: number;
  on: boolean;
}

/** When each card's playable highlight turns on and off (in hand, affordable, not Unplayable, not lifted). */
function playableGlowModel(result: SimResult, timeline: CombatTimeline, view: CombatSimView): Record<string, GlowChange[]> {
  const changes: Record<string, GlowChange[]> = {};
  const playableIn = (state: SimState, uid: string, lifted: string | null) => {
    if (uid === lifted || !state.piles.hand.includes(uid)) return false;
    const card = state.cards[uid];
    const def = view.catalog.cards[card.id];
    if (!def) return false;
    const effective = effectiveCard(def, card.upgraded);
    if (effective.keywords.includes("Unplayable")) return false;
    return def.isXCost || effective.cost <= state.energy;
  };
  const record = (state: SimState, t: number, lifted: string | null) => {
    for (const uid of Object.keys(state.cards)) {
      const on = playableIn(state, uid, lifted);
      const list = (changes[uid] ??= []);
      if (list.length === 0 || list[list.length - 1].on !== on) list.push({ t: list.length === 0 && t === 0 ? -1 : t, on });
    }
  };
  record(result.start, 0, null);
  let lifted: string | null = null;
  for (const beat of timeline.beats) {
    if (beat.event.kind === "select") lifted = beat.event.uid;
    else if (beat.event.kind === "move" && beat.event.uid === lifted && beat.event.from === "hand") lifted = null;
    record(beat.after, beat.start / 1000, lifted);
  }
  return changes;
}

/** Highlight on: width -> 0.075 over 0.5 s Cubic Out; off: -> 0 over 0.5 s Linear. Returns 0..1. */
function glowAt(changes: GlowChange[] | undefined, tMs: number): number {
  if (!changes) return 0;
  const t = tMs / 1000;
  let level = 0;
  for (let i = 0; i < changes.length; i += 1) {
    const change = changes[i];
    if (change.t > t) break;
    if (change.t < 0) {
      level = change.on ? 1 : 0;
      continue;
    }
    const end = Math.min(t, changes[i + 1]?.t ?? Infinity);
    const k = clamp01((end - change.t) / 0.5);
    level = change.on ? level + (1 - level) * ease.cubicOut(k) : level * (1 - k);
  }
  return level;
}

interface MemoCardProps {
  card: CodexCard;
  upgraded: boolean;
  cost: number;
  unplayable: boolean;
  suffix: string | null;
  weighted: boolean;
}

const MemoCard = memo(function MemoCard({ card, upgraded, cost, unplayable, suffix, weighted }: MemoCardProps) {
  const tileCard = useMemo(() => ({ ...card, deprecated: false }), [card]);
  // The overlay reads the clock from context, so the tile itself only re-renders when these props change.
  const afflictionOverlay = useMemo(() => (weighted ? <WeightedOverlay /> : undefined), [weighted]);
  const costContent = useMemo(
    () => (unplayable ? <span style={{ color: STS_RED, ...gameStroke(UNPLAYABLE_COST_OUTLINE, CARD_W, 16) }}>{cost}</span> : undefined),
    [cost, unplayable],
  );
  return (
    <CardTile
      card={tileCard}
      serviceLocale="ko"
      showUpgrade={upgraded}
      showBeta={false}
      width={CARD_W}
      descriptionSuffix={suffix}
      costContent={costContent}
      afflictionOverlay={afflictionOverlay}
    />
  );
});

/**
 * NDamageNumVfx (scenes/vfx/vfx_damage_num.tscn): spawns 100 px above the
 * creature's VFX point with a little jitter, flies on a random velocity
 * (x -100..100, y -800..-700 px/s) under 2000 px/s^2 gravity, starts at scale
 * 1.2-1.3 tinted Color(0.97, 0.167, 0.078), then tweens modulate to cream
 * (0.5 s Cubic Out), scale to 1 (1.2 s Quad Out) and alpha to 0 (2 s Quad In).
 * The game draws the random values from Rng.Chaotic; here they are seeded by
 * the step so a frame is the same on every run.
 */
const DAMAGE_NUM_MS = 2000;
const DAMAGE_START = [0.97, 0.16684, 0.0776];
const CREAM_RGB = [1, 0.964706, 0.886275];
const DAMAGE_OUTLINE = [0.21, 0.202685, 0.1869];

function seeded(step: number, salt: number): number {
  return nextRandom(seedRandom(step * 7919 + salt * 104729))[0];
}

function rgb(color: number[], tint: number[]): string {
  return `rgb(${color.map((value, i) => Math.round(value * tint[i] * 255)).join(", ")})`;
}

function DamageNumbers({ timeline, t, player, monsters }: { timeline: CombatTimeline; t: number; player: CreatureBox | null; monsters: CreatureBox[] }) {
  const numbers: React.ReactNode[] = [];
  for (const beat of timeline.beats) {
    const event = beat.event;
    if (event.kind !== "damage") continue;
    const start = commitTime(beat);
    const age = (t - start) / 1000;
    if (age < 0 || age * 1000 > DAMAGE_NUM_MS) continue;
    const box = event.creature === "player" ? player : monsters[Number(event.creature.slice(1))];
    if (!box) continue;
    // NDamageNumVfx.Create(target, result): unblocked damage (+ overkill).
    const shown = event.amount - event.blocked;
    if (shown <= 0) continue;
    const k = box.scale;
    const r = (salt: number) => seeded(beat.step, salt);
    const vx = -100 + 200 * r(1);
    const vy = -800 + 100 * r(2);
    const x = box.x + (-10 + 20 * r(3)) * k + vx * age * k;
    const y = box.y - box.height / 2 + (-100 + (-5 + 10 * r(4))) * k + (vy * age + 1000 * age * age) * k;
    const scale0 = 1.2 + 0.1 * r(5);
    const rotate = -5 + 10 * r(6);
    const colorT = 1 - (1 - Math.min(1, age / 0.5)) ** 3;
    const tint = DAMAGE_START.map((value, i) => value + (CREAM_RGB[i] - value) * colorT);
    const scaleT = 1 - (1 - Math.min(1, age / 1.2)) ** 2;
    const scale = scale0 + (1 - scale0) * scaleT;
    const alpha = 1 - Math.min(1, age / 2) ** 2;
    numbers.push(
      <div
        key={beat.step}
        className="pointer-events-none absolute flex items-center justify-center"
        style={{
          left: x - 128 * k,
          top: y - 128 * k,
          width: 256 * k,
          height: 256 * k,
          transform: `rotate(${rotate}deg) scale(${scale})`,
          opacity: alpha,
          zIndex: 700,
          fontFamily: KREON,
          fontWeight: 400,
          fontSize: 64 * k,
          letterSpacing: 2 * k,
          color: rgb(CREAM_RGB, tint),
          ...outline(rgb(DAMAGE_OUTLINE, tint), 20 * k * 0.5),
          textShadow: `${5 * k}px ${4 * k}px 0 rgba(0,0,0,0.125)`,
        }}
      >
        {shown}
      </div>,
    );
  }
  return <>{numbers}</>;
}

function Badges({ beats, t }: { beats: TimelineBeat[]; t: number }) {
  const shown = beats.filter((beat) => (beat.event.kind === "unimplemented" || beat.event.kind === "rejected") && t - beat.start < 1800);
  if (shown.length === 0) return null;
  return (
    <div className="absolute flex flex-col items-center gap-2" style={{ left: 0, right: 0, top: 110, zIndex: 800 }}>
      {shown.map((beat) => {
        const event = beat.event;
        const text = event.kind === "unimplemented" ? `미구현: ${event.what}` : event.kind === "rejected" ? event.reason : "";
        return (
          <div
            key={beat.step}
            className="rounded-full px-6 py-2"
            style={{
              fontSize: 32,
              color: event.kind === "rejected" ? "#ffd7d7" : STS_GOLD,
              background: event.kind === "rejected" ? "rgba(120, 20, 20, 0.85)" : "rgba(20, 20, 24, 0.85)",
              border: "2px solid rgba(255,255,255,0.15)",
            }}
          >
            {text}
          </div>
        );
      })}
    </div>
  );
}
