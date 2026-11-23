"use client";

import { useState, type CSSProperties } from "react";
import Image from "@/components/ui/static-image";
import type { Sts1Encounter, Sts1EncounterMonster } from "@/lib/sts1/encounters";
import { sts1SceneUrl } from "@/lib/sts1/paths";
import type { Sts1Monster, Sts1MonsterRect } from "@/lib/sts1/types";
import { textureSize } from "@/lib/sts1/vfx/assets";
import { Sts1MonsterStage } from "./monster-stage";

/** The game's virtual screen; creatures stand on AbstractDungeon.floorY = 340 (y up). */
const SCREEN = { width: 1920, height: 1080 };
const FLOOR_Y = 340;
/** AbstractMonster: drawX = Settings.WIDTH * 0.75 + offsetX. */
const MONSTER_ORIGIN_X = SCREEN.width * 0.75;
/** AbstractPlayer: drawX = Settings.WIDTH * 0.25; "Shield and Spear" moves it to the middle (AbstractDungeon.nextRoomTransition). */
const PLAYER_X = SCREEN.width * 0.25;
const SURROUNDED_PLAYER_X = SCREEN.width / 2;
/** The stage's `tile` layout keeps 4px around the body; the actor box grows by it so the body lands on its game rect. */
const TILE_INSET = 4;
/**
 * Each stage holds a Spine context plus two effect canvases; browsers keep about 16
 * WebGL contexts. Past this many actors, skeletons drop their effect canvases
 * (idle needs none; image bodies like Hexaghost keep them, the engine draws them).
 */
const ACTORS_WITH_EFFECTS = 5;

export interface Sts1ScenePlacement {
  slug: string;
  x: number;
  y: number;
}

type Roll = () => number;

/** One composition the game can field: fixed monsters at their slots, each choice drawn like MonsterHelper draws it. */
export function sts1EncounterComposition(encounter: Sts1Encounter, variantIndex = 0, roll: Roll | null = null): Sts1ScenePlacement[] {
  const variant = encounter.variants.length ? encounter.variants[Math.min(variantIndex, encounter.variants.length - 1)] : null;
  const fixed = variant ?? encounter.monsters;
  const placements = fixed.flatMap((row) => row.at.map(([x, y]) => ({ slug: row.slug, x, y })));
  for (const choice of variant ? [] : encounter.choices) {
    const left = new Map(choice.from.map((row) => [row.slug, row.count]));
    for (let pick = 0; pick < choice.pick; pick += 1) {
      const open = choice.independent ? choice.from : choice.from.filter((row) => (left.get(row.slug) ?? 0) > 0);
      const row = roll ? weighted(open, choice.independent ? null : left, roll) : open[pick % open.length];
      if (!row) break;
      left.set(row.slug, (left.get(row.slug) ?? 0) - 1);
      const [x, y] = row.at[pick];
      placements.push({ slug: row.slug, x, y });
    }
  }
  return placements.sort((a, b) => a.x - b.x);
}

function weighted(rows: Sts1EncounterMonster[], left: Map<string, number> | null, roll: Roll): Sts1EncounterMonster | undefined {
  const weight = (row: Sts1EncounterMonster) => (left ? left.get(row.slug) ?? 0 : row.count);
  let target = roll() * rows.reduce((sum, row) => sum + weight(row), 0);
  return rows.find((row) => (target -= weight(row)) < 0) ?? rows.at(-1);
}

/** The body's rect in game units around the creature's origin (as Sts1MonsterStage fits it). */
function gameRect(monster: Sts1Monster): Sts1MonsterRect | null {
  if (monster.spine) {
    const unit = 1 / (monster.vfx?.skeletonScale ?? 1);
    const { x, y, width, height } = monster.spine.still;
    return { x: x * unit, y: y * unit, width: width * unit, height: height * unit };
  }
  const size = monster.vfx?.image ? textureSize(monster.vfx.image) : null;
  return size ? { x: -size.width / 2, y: 0, width: size.width, height: size.height } : null;
}

function actorStyle(rect: Sts1MonsterRect, drawX: number, drawY: number): CSSProperties {
  const pct = (value: number, total: number) => `${(value / total) * 100}%`;
  return {
    left: `calc(${pct(drawX + rect.x, SCREEN.width)} - ${TILE_INSET}px)`,
    bottom: `calc(${pct(drawY + rect.y, SCREEN.height)} - ${TILE_INSET}px)`,
    width: `calc(${pct(rect.width, SCREEN.width)} + ${TILE_INSET * 2}px)`,
    height: `calc(${pct(rect.height, SCREEN.height)} + ${TILE_INSET * 2}px)`,
  };
}

function SceneActor({ monster, drawX, drawY, crowded }: { monster: Sts1Monster; drawX: number; drawY: number; crowded: boolean }) {
  const rect = gameRect(monster);
  if (!rect) return null;
  return (
    <div className="pointer-events-none absolute z-20" style={actorStyle(rect, drawX, drawY)} data-encounter-monster={monster.slug}>
      <Sts1MonsterStage monster={monster} playback={null} variant="tile" className="absolute inset-0" effects={!crowded || !monster.spine} />
    </div>
  );
}

/**
 * A combat room as the game sets it: the act's background, each monster's idle
 * at the offset its constructor gets (game 1920x1080 coordinates, scaled to a
 * 16:9 box), the player on the left, and the act's foreground over them.
 * `monsters` are the rows for the encounter's slugs; `player` is the Ironclad stage.
 */
export function Sts1EncounterScene({
  encounter,
  monsters,
  player = null,
  variantIndex = 0,
  rerollLabel = "다른 구성",
  className,
}: {
  encounter: Sts1Encounter;
  monsters: Sts1Monster[];
  player?: Sts1Monster | null;
  variantIndex?: number;
  rerollLabel?: string;
  className?: string;
}) {
  // A rolled composition belongs to the encounter it was rolled for; the first render is the deterministic one.
  const [rolled, setRolled] = useState<{ slug: string; placements: Sts1ScenePlacement[] } | null>(null);
  const bySlug = new Map(monsters.map((monster) => [monster.slug, monster]));
  const placements = rolled?.slug === encounter.slug ? rolled.placements : sts1EncounterComposition(encounter, variantIndex);
  const canReroll = encounter.choices.length > 0 || encounter.variants.length > 1;
  const act = encounter.sceneDungeon;
  // TheCityScene.randomizeScene draws the throne whenever TheCollector is in the room.
  const background = act === "city" && placements.some((placement) => placement.slug === "the-collector") ? "city-collector" : act;
  const foreground = act === "ending" ? null : `${act}-fg`;
  const playerX = encounter.key === "Shield and Spear" ? SURROUNDED_PLAYER_X : PLAYER_X;
  const crowded = placements.length + (player ? 1 : 0) > ACTORS_WITH_EFFECTS;

  const reroll = () => {
    const variant = Math.floor(Math.random() * Math.max(1, encounter.variants.length));
    setRolled({ slug: encounter.slug, placements: sts1EncounterComposition(encounter, variant, Math.random) });
  };

  return (
    <div
      className={className ?? "relative aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl"}
      data-encounter-scene={encounter.slug}
    >
      <Image src={sts1SceneUrl(background)} alt="" fill priority sizes="(min-width: 1024px) 704px, 100vw" className="object-cover" />
      {player ? <SceneActor monster={player} drawX={playerX} drawY={FLOOR_Y} crowded={crowded} /> : null}
      {placements.map((placement, index) => {
        const monster = bySlug.get(placement.slug);
        return monster ? (
          <SceneActor
            key={`${index}:${placement.slug}`}
            monster={monster}
            drawX={MONSTER_ORIGIN_X + placement.x}
            drawY={FLOOR_Y + placement.y}
            crowded={crowded}
          />
        ) : null;
      })}
      {foreground ? (
        <Image src={sts1SceneUrl(foreground)} alt="" fill sizes="(min-width: 1024px) 704px, 100vw" className="pointer-events-none z-30 object-cover" />
      ) : null}
      {canReroll ? (
        <button
          type="button"
          onClick={reroll}
          className="absolute bottom-2 right-2 z-40 rounded-md border border-white/15 bg-black/70 px-2 py-1 font-game-text text-[10px] font-bold text-gray-100 shadow-lg backdrop-blur-sm transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 sm:text-xs"
        >
          {rerollLabel}
        </button>
      ) : null}
    </div>
  );
}
