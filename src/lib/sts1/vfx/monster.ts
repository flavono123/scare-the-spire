import type { SpriteBatch } from "./batch";
import type { Creature } from "./world";

/**
 * What an STS1 monster class does every frame beyond `AbstractMonster`: the
 * particles it keeps spawning, the parts it draws itself and the state its
 * `changeState` keeps. The stage drives it like the game's room does.
 *
 * Draw order per frame, as in `AbstractDungeon.render`:
 * behind canvas: effects with `renderBehind` -> `renderBehind` -> `renderBody`,
 * then the skeleton (or still image) in the page,
 * front canvas: `renderFront` -> the other effects -> top-level effects.
 */
export interface MonsterBehavior {
  /** The class's `update()` extras; runs every frame before the effect lists update. May set `animX`/`animY`. */
  update(monster: Creature): void;
  /** What the class draws before `super.render` (under the skeleton). */
  renderBehind?(sb: SpriteBatch, monster: Creature): void;
  /** The monster itself when it has no skeleton (Hexaghost); the stage then hides its still. */
  renderBody?(sb: SpriteBatch, monster: Creature): void;
  /** What the class draws after `super.render` (over the skeleton). */
  renderFront?(sb: SpriteBatch, monster: Creature): void;
  /** `changeState(key)` from a `ChangeStateAction` on a move's timeline. */
  changeState?(key: string, monster: Creature): void;
  /**
   * A move button was pressed (`key` is the game's byte constant name, e.g. `REBIRTH`).
   * For monsters whose moves belong to a form, this puts the monster in that form first.
   */
  onMove?(key: string | null, monster: Creature): void;
  /** The idle clip for the current state, when it differs from the skeleton's default (Awakened One's second form). */
  idleAnimation?(): string | null;
  dispose?(): void;
}

export type MonsterBehaviorFactory = (monster: Creature) => MonsterBehavior;
