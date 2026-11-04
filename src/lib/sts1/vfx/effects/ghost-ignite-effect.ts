import { AbstractGameEffect } from "../effect";
import { Color } from "../gdx";
import { AbstractDungeon } from "../world";
import { FireBurstParticleEffect } from "./fire-burst-particle-effect";
import { LightFlareParticleEffect } from "./light-flare-particle-effect";

const COUNT = 25;

/** vfx/combat/GhostIgniteEffect. */
export class GhostIgniteEffect extends AbstractGameEffect {
  private x: number;
  private y: number;

  constructor(x: number, y: number) {
    super();
    this.x = x;
    this.y = y;
  }

  update(): void {
    for (let i = 0; i < COUNT; i += 1) {
      AbstractDungeon.effectsQueue.push(new FireBurstParticleEffect(this.x, this.y));
      AbstractDungeon.effectsQueue.push(new LightFlareParticleEffect(this.x, this.y, Color.CHARTREUSE));
    }
    this.isDone = true;
  }

  render(): void {}

  dispose(): void {}
}
