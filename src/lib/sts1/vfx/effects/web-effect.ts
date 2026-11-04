import { AbstractGameEffect } from "../effect";
import type { Creature } from "../world";
import { AbstractDungeon, Gdx, Settings } from "../world";
import { WebLineEffect } from "./web-line-effect";
import { WebParticleEffect } from "./web-particle-effect";

/** vfx/combat/WebEffect. */
export class WebEffect extends AbstractGameEffect {
  private timer: number;
  private count: number;
  private target: Creature;
  private srcX: number;
  private srcY: number;

  constructor(target: Creature, srcX: number, srcY: number) {
    super();
    this.timer = 0;
    this.count = 0;
    this.target = target;
    this.srcX = srcX;
    this.srcY = srcY;
    this.duration = 1;
  }

  update(): void {
    this.duration -= Gdx.graphics.getDeltaTime();
    this.timer -= Gdx.graphics.getDeltaTime();
    if (this.timer < 0) {
      this.timer += 0.1;
      switch (this.count) {
        case 0:
          AbstractDungeon.effectsQueue.push(new WebLineEffect(this.srcX, this.srcY, true));
          AbstractDungeon.effectsQueue.push(new WebLineEffect(this.srcX, this.srcY, true));
          AbstractDungeon.effectsQueue.push(
            new WebParticleEffect(
              this.target.hb.cX - 90 * Settings.scale,
              this.target.hb.cY - 10 * Settings.scale,
            ),
          );
          break;
        case 1:
          AbstractDungeon.effectsQueue.push(new WebLineEffect(this.srcX, this.srcY, true));
          AbstractDungeon.effectsQueue.push(new WebLineEffect(this.srcX, this.srcY, true));
          break;
        case 2:
          AbstractDungeon.effectsQueue.push(new WebLineEffect(this.srcX, this.srcY, true));
          AbstractDungeon.effectsQueue.push(new WebLineEffect(this.srcX, this.srcY, true));
          AbstractDungeon.effectsQueue.push(
            new WebParticleEffect(
              this.target.hb.cX + 70 * Settings.scale,
              this.target.hb.cY + 80 * Settings.scale,
            ),
          );
          break;
        case 3:
          break;
        case 4:
          AbstractDungeon.effectsQueue.push(
            new WebParticleEffect(
              this.target.hb.cX + 30 * Settings.scale,
              this.target.hb.cY - 100 * Settings.scale,
            ),
          );
          break;
        default:
          break;
      }
      this.count++;
    }
    if (this.duration < 0) {
      this.isDone = true;
    }
  }

  render(): void {}

  dispose(): void {}
}
