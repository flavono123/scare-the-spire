import { MathUtils } from "../gdx";
import type { MonsterBehavior, MonsterBehaviorFactory } from "../monster";
import { Settings, type Creature } from "../world";

/**
 * monsters/city/BronzeOrb: bobs on the wall clock. `count` is its spawn
 * index; even and odd orbs bob in opposite phase.
 */
export class BronzeOrb implements MonsterBehavior {
  private count: number;

  constructor(count: number) {
    this.count = count;
  }

  update(monster: Creature): void {
    // System.currentTimeMillis() / 6L % 360L
    const degrees = Math.floor(Date.now() / 6) % 360;
    if (this.count % 2 === 0) {
      monster.animY = MathUtils.cosDeg(degrees) * 6 * Settings.scale;
    } else {
      monster.animY = -MathUtils.cosDeg(degrees) * 6 * Settings.scale;
    }
  }
}

/** The first orb Bronze Automaton spawns (`new BronzeOrb(-300, 200, 0)`). */
export const createBronzeOrb: MonsterBehaviorFactory = () => new BronzeOrb(0);
