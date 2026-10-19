"use client";

import { memo, useMemo, type CSSProperties } from "react";
import { CardTile } from "@/components/codex/card-tile";
import type { CodexCard } from "@/lib/codex-types";
import { effectiveCard } from "@/lib/combat-sim/engine";
import { nextRandom, seedRandom } from "@/lib/combat-sim/rng";
import type { CombatTimeline, TimelineBeat } from "@/lib/combat-sim/timeline";
import type { SimCreature, SimResult, SimState } from "@/lib/combat-sim/types";
import { ENERGY_OUTLINE_COLOR, FONT_CQI, gameStroke, TEXT_CREAM } from "@/lib/sts2-card-style";
import { resolveSts2EnergyIcon, type Sts2EnergyIconVariant } from "@/lib/sts2-energy-icons";
import { substituteAmount } from "@/lib/sts2-enchant-rules";
import { SpineActor, type ActorStatus, type SpineCue, type SpineViewport } from "./spine-actor";
import {
  CARD_H,
  CARD_W,
  ORB,
  PILES,
  STAGE_H,
  STAGE_W,
  commitTime,
  interpolatedPose,
  monsterBoxes,
  orbBaseAngle,
  playerBox,
  visibleState,
  type CreatureBox,
} from "./stage-layout";
import type { CombatSimMonsterView, CombatSimView, EnergyCounterAsset } from "./view-types";
import { WeightedOverlay } from "./weighted-overlay";

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
  const player = playerBox();
  const monsters = useMemo(() => monsterBoxes(view.monsters, view.combatLayout), [view.monsters, view.combatLayout]);
  const cues = useMemo(() => animationCues(timeline, view), [timeline, view]);
  const allUids = useMemo(() => {
    const uids = new Set<string>();
    for (const step of result.steps) for (const uid of Object.keys(step.state.cards)) uids.add(uid);
    for (const uid of Object.keys(result.start.cards)) uids.add(uid);
    return [...uids];
  }, [result]);

  return (
    <div className="absolute left-0 top-0 overflow-hidden" style={{ width: STAGE_W, height: STAGE_H, background: "#0b0b0f" }} data-game-locale="kor">
      <Background url={view.background} />

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
        onActorStatus={onActorStatus}
      />
      {view.monsters.map((monster, index) => {
        const state = visible.monsters[index];
        if (!state) return null;
        return (
          <Creature
            key={`m${index}`}
            id={`m${index}`}
            box={monsters[index]}
            creature={state}
            spine={monster.spine}
            imageUrl={monster.staticArt ? (state.moveId ? monster.staticArt.byMove[state.moveId] : null) ?? monster.staticArt.defaultImage : monster.imageUrl}
            cues={cues[`m${index}`] ?? []}
            t={t}
            pixelRatio={pixelRatio}
            viewport={monster.layout ? viewportFromLayout(monster.layout) : null}
            view={view}
            onActorStatus={onActorStatus}
          >
            <Intent view={view} monster={monster} moveId={state.moveId} box={monsters[index]} t={t} />
          </Creature>
        );
      })}

      {view.character.energyCounter && (
        <EnergyOrb
          asset={view.character.energyCounter}
          energy={visible.energy}
          maxEnergy={visible.maxEnergy}
          angle={orbBaseAngle(timeline, result.start.energy, t)}
        />
      )}
      <Piles view={view} state={visible} />

      {allUids.map((uid) => (
        <CardView
          key={uid}
          uid={uid}
          view={view}
          beat={frame.beat}
          progress={frame.progress}
          state={frame.state}
          energy={visible.energy}
          t={t}
          flash={afflictionFlash(recent, uid, t)}
        />
      ))}

      <DamageNumbers timeline={timeline} t={t} player={player} monsters={monsters} />
      {badges && <Badges beats={recent} t={t} />}
    </div>
  );
}

function Background({ url }: { url: string | null }) {
  if (!url) return null;
  return (
    <div className="absolute left-0 top-0" style={{ width: STAGE_W, height: 1260 }}>
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
    const asset = creature === "player" ? view.character.spine : view.monsters[Number(creature.slice(1))]?.spine;
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
  spine: CombatSimView["character"]["spine"];
  imageUrl: string | null;
  cues: SpineCue[];
  t: number;
  pixelRatio: number;
  viewport: SpineViewport | null;
  view: CombatSimView;
  onActorStatus: (id: string, status: ActorStatus) => void;
  children?: React.ReactNode;
}

function Creature({ id, box, creature, spine, imageUrl, cues, t, pixelRatio, viewport, view, onActorStatus, children }: CreatureProps) {
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
      <HealthBar creature={creature} box={box} view={view} />
    </>
  );
}

const HP_BAR_HEIGHT = 24;

function HealthBar({ creature, box, view }: { creature: SimCreature; box: CreatureBox; view: CombatSimView }) {
  const width = Math.max(220, Math.min(320, box.width));
  const left = box.x - width / 2;
  const top = box.y + 22;
  const ratio = creature.maxHp > 0 ? Math.max(0, Math.min(1, creature.hp / creature.maxHp)) : 0;
  const hasBlock = creature.block > 0;
  return (
    <div className="absolute" style={{ left, top, width, zIndex: 30 }}>
      {/* health_bar.tscn: HpBackground modulate, HpForeground self_modulate, BlockOutline when blocking */}
      <div
        className="relative overflow-hidden rounded-full"
        style={{
          height: HP_BAR_HEIGHT,
          background: "rgba(42, 96, 107, 0.75)",
          boxShadow: hasBlock ? "0 0 0 4px rgba(180, 226, 255, 1)" : "0 0 0 3px rgba(0,0,0,0.85)",
        }}
      >
        <div className="absolute inset-y-0 left-0" style={{ width: `${ratio * 100}%`, background: "rgb(204, 12, 12)" }} />
      </div>
      <div
        className="absolute inset-x-0 flex items-center justify-center"
        style={{ top: -10, height: HP_BAR_HEIGHT + 20, fontFamily: KREON, fontWeight: 700, fontSize: 34, color: TEXT_CREAM, ...outline("#900000", 10) }}
      >
        {creature.hp}/{creature.maxHp}
      </div>
      {hasBlock && (
        <div className="absolute flex items-center justify-center" style={{ left: -62, top: -26, width: 76, height: 76 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={view.ui.block} alt="" className="absolute inset-0 h-full w-full" />
          <span className="relative" style={{ fontFamily: KREON, fontWeight: 700, fontSize: 34, color: TEXT_CREAM, ...outline("#1d3b55", 10) }}>{creature.block}</span>
        </div>
      )}
      <PowerRow creature={creature} view={view} />
    </div>
  );
}

function PowerRow({ creature, view }: { creature: SimCreature; view: CombatSimView }) {
  if (creature.powers.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {creature.powers.map((power) => (
        <div key={power.id} className="relative" style={{ width: 60, height: 60 }} title={view.catalog.powers[power.id]?.name ?? power.id}>
          {view.powerIcons[power.id] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={view.powerIcons[power.id]!} alt="" className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-full bg-zinc-800 text-xs text-zinc-200">{power.id.slice(0, 3)}</div>
          )}
          {power.amount !== 1 && (
            <span className="absolute -bottom-1 -right-1" style={{ fontFamily: KREON, fontWeight: 700, fontSize: 28, color: TEXT_CREAM, ...outline("#000", 8) }}>
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
      style={{ left: box.x - 200, width: 400, top: box.y - box.height - 96 + bob, zIndex: 35 }}
      data-combat-sim-intent={moveId}
    >
      {move.intents.map((intent, index) => {
        const isAttack = intent.damage !== undefined && (intent.type === "SingleAttackIntent" || intent.type === "MultiAttackIntent");
        const repeat = intent.repeat ?? 1;
        const icon = isAttack ? attackIcon((intent.damage ?? 0) * repeat) : INTENT_ICONS[intent.type] ?? "unknown";
        return (
          <div key={`${intent.type}-${index}`} className="relative" style={{ width: 84, height: 84 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/images/sts2/intents/${icon}.png`} alt="" className="h-full w-full object-contain" />
            {isAttack && (
              <span
                className="absolute bottom-[-6px] left-0 whitespace-nowrap"
                style={{ fontFamily: KREON, fontWeight: 700, fontSize: 38, color: TEXT_CREAM, ...outline("#000", 10) }}
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

/** NEnergyCounter: layers from the scene, rotation layers turning, darkened at 0 (energy_orb_dark: hsv s0.5 v0.85, modulate DarkGray). */
function EnergyOrb({ asset, energy, maxEnergy, angle }: { asset: EnergyCounterAsset; energy: number; maxEnergy: number; angle: number }) {
  const scale = ORB.size / asset.size;
  const empty = energy === 0;
  const label = asset.label;
  return (
    <div
      className="absolute"
      style={{ left: ORB.x - ORB.size / 2, top: ORB.y - ORB.size / 2, width: ORB.size, height: ORB.size, zIndex: 60 }}
      data-combat-sim-energy={`${energy}/${maxEnergy}`}
    >
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
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          fontFamily: KREON,
          fontWeight: 700,
          fontSize: label.fontSize * scale,
          letterSpacing: "0.04em",
          color: empty ? STS_RED : label.fontColor,
          ...outline(empty ? UNPLAYABLE_COST_OUTLINE : label.outlineColor, label.outlineSize * scale * 0.5),
          textShadow: `${label.shadowOffset[0] * scale}px ${label.shadowOffset[1] * scale}px 0 ${label.shadowColor}`,
        }}
      >
        {energy}/{maxEnergy}
      </div>
    </div>
  );
}

function Piles({ view, state }: { view: CombatSimView; state: SimState }) {
  const button = (key: "draw" | "discard" | "exhaust", icon: string | undefined, count: number, outlineColor: string) => {
    if (key === "exhaust" && count === 0) return null;
    const position = PILES[key];
    return (
      <div className="absolute" style={{ left: position.x - 64, top: position.y - 64, width: 128, height: 128, zIndex: 60 }} data-combat-sim-pile={key}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {icon && <img src={icon} alt="" className="h-full w-full object-contain" />}
        <div className="absolute flex items-center justify-center" style={{ left: key === "draw" ? 66 : -10, top: 66, width: 72, height: 60 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {view.ui.pile_button_count && <img src={view.ui.pile_button_count} alt="" className="absolute inset-0 h-full w-full" />}
          <span className="relative" style={{ fontFamily: KREON, fontWeight: 700, fontSize: 38, color: TEXT_CREAM, ...outline(outlineColor, 9) }}>{count}</span>
        </div>
      </div>
    );
  };
  // Count font_outline_color in draw_pile.tscn / discard_pile.tscn / exhaust_pile.tscn
  return (
    <>
      {button("draw", view.ui.draw_pile, state.piles.draw.length, "#881f20")}
      {button("discard", view.ui.discard_pile, state.piles.discard.length, "#881f20")}
      {button("exhaust", view.ui.exhaust_pile, state.piles.exhaust.length, "#341f2f")}
    </>
  );
}

function afflictionFlash(beats: TimelineBeat[], uid: string, t: number): number {
  for (let i = beats.length - 1; i >= 0; i -= 1) {
    const beat = beats[i];
    if (t - beat.start > 700) break;
    if (beat.event.kind === "afflictionTrigger" && beat.event.uid === uid) {
      return 1 - (t - beat.start) / 700;
    }
  }
  return 0;
}

interface CardViewProps {
  uid: string;
  view: CombatSimView;
  beat: TimelineBeat | null;
  progress: number;
  state: SimState;
  energy: number;
  t: number;
  flash: number;
}

function CardView({ uid, view, beat, progress, state, energy, t, flash }: CardViewProps) {
  const pose = interpolatedPose(beat, progress, state, uid);
  const card = (beat?.after.cards[uid] ?? state.cards[uid]) ?? null;
  const def = card ? view.catalog.cards[card.id] : null;
  const entity = card ? view.cards[card.id] : null;
  const cost = def && card ? effectiveCard(def, card.upgraded).cost : 0;
  const inHand = state.piles.hand.includes(uid);
  const unplayable = Boolean(inHand && def && !def.isXCost && cost > energy);
  const affliction = card?.affliction ?? null;
  const suffix = affliction ? view.catalog.afflictions[affliction.id]?.extraCardText ?? null : null;
  if (!pose || !card || !entity) return null;
  const opacity = Math.max(0, Math.min(1, pose.opacity));
  return (
    <div
      className="absolute left-0 top-0"
      data-combat-sim-card={uid}
      style={{
        width: CARD_W,
        height: CARD_H,
        transform: `translate(${pose.x - CARD_W / 2}px, ${pose.y - CARD_H / 2}px) rotate(${pose.rotate}deg) scale(${pose.scale})`,
        opacity,
        zIndex: pose.z,
        visibility: opacity < 0.01 ? "hidden" : "visible",
      }}
    >
      <MemoCard
        card={entity}
        upgraded={card.upgraded}
        cost={cost}
        unplayable={unplayable}
        suffix={suffix && affliction ? substituteAmount(suffix, affliction.amount, { asEnergyIcon: true }) : null}
      />
      {affliction?.id === "WEIGHTED" && opacity >= 0.01 && (
        <>
          <WeightedOverlay t={t} boost={flash * 0.6} />
          <CostOrb card={entity} cost={cost} unplayable={unplayable} />
        </>
      )}
    </div>
  );
}

/**
 * The tile's cost orb, drawn again above an affliction overlay so the cost stays
 * readable. Same box as CardTile (card.tscn EnergyIcon: 64x64 at -16,-16).
 */
function CostOrb({ card, cost, unplayable }: { card: CodexCard; cost: number; unplayable: boolean }) {
  const color = card.visualColor ?? card.color;
  const stroke = unplayable
    ? gameStroke(UNPLAYABLE_COST_OUTLINE, CARD_W, 16)
    : gameStroke(ENERGY_OUTLINE_COLOR[color] ?? ENERGY_OUTLINE_COLOR.colorless, CARD_W, 16);
  return (
    <div className="absolute" style={{ left: -16, top: -16, width: 64, height: 64, zIndex: 21 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={resolveSts2EnergyIcon(color as Sts2EnergyIconVariant)} alt="" className="absolute inset-0 h-full w-full object-contain" />
      <span
        className="absolute inset-0 flex items-center justify-center font-black"
        style={{
          color: unplayable ? STS_RED : TEXT_CREAM,
          fontSize: (FONT_CQI.cost / 100) * CARD_W,
          fontFamily: "var(--font-game-title)",
          letterSpacing: "-0.02em",
          ...(stroke as CSSProperties),
        }}
      >
        {card.isXCost ? "X" : cost}
      </span>
    </div>
  );
}

const MemoCard = memo(function MemoCard({ card, upgraded, cost, unplayable, suffix }: { card: CodexCard; upgraded: boolean; cost: number; unplayable: boolean; suffix: string | null }) {
  const tileCard = useMemo(() => ({ ...card, deprecated: false }), [card]);
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

function DamageNumbers({ timeline, t, player, monsters }: { timeline: CombatTimeline; t: number; player: CreatureBox; monsters: CreatureBox[] }) {
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
