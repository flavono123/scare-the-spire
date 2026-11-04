import { AbstractGameEffect } from "../effect";
import type { Creature } from "../world";
import { AbstractDungeon, CardCrawlGame } from "../world";
import { ExhaustEmberEffect } from "./exhaust-ember-effect";
import { FlameParticleEffect } from "./flame-particle-effect";

/** vfx/combat/InflameEffect. */
export class InflameEffect extends AbstractGameEffect {
  x: number;
  y: number;

  constructor(creature: Creature) {
    super();
    this.x = creature.hb.cX;
    this.y = creature.hb.cY;
  }

  update(): void {
    CardCrawlGame.sound.play("ATTACK_FIRE");
    for (let i = 0; i < 75; i += 1) {
      AbstractDungeon.effectsQueue.push(new FlameParticleEffect(this.x, this.y));
    }
    for (let i = 0; i < 20; i += 1) {
      AbstractDungeon.effectsQueue.push(new ExhaustEmberEffect(this.x, this.y));
    }
    this.isDone = true;
  }

  render(): void {}

  dispose(): void {}
}
