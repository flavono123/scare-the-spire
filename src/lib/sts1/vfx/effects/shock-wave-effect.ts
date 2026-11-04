import { AbstractGameEffect } from "../effect";
import type { ShockWaveType } from "../enums";
import { Color, MathUtils } from "../gdx";
import { AbstractDungeon, CardCrawlGame, Settings } from "../world";
import { BlurWaveAdditiveEffect } from "./blur-wave-additive-effect";
import { BlurWaveChaoticEffect } from "./blur-wave-chaotic-effect";
import { BlurWaveNormalEffect } from "./blur-wave-normal-effect";

/** vfx/combat/ShockWaveEffect. */
export class ShockWaveEffect extends AbstractGameEffect {
  private x: number;
  private y: number;
  private type: ShockWaveType;

  constructor(x: number, y: number, color: Color, type: ShockWaveType) {
    super();
    this.x = x;
    this.y = y;
    this.type = type;
    this.color = color;
  }

  update(): void {
    const speed = MathUtils.random(1000, 1200) * Settings.scale;
    switch (this.type) {
      case "ADDITIVE":
        for (let i = 0; i < 40; i += 1) {
          AbstractDungeon.effectsQueue.push(new BlurWaveAdditiveEffect(this.x, this.y, this.color.cpy(), speed));
        }
        break;
      case "NORMAL":
        for (let i = 0; i < 40; i += 1) {
          AbstractDungeon.effectsQueue.push(new BlurWaveNormalEffect(this.x, this.y, this.color.cpy(), speed));
        }
        break;
      case "CHAOTIC":
        CardCrawlGame.screenShake.shake("HIGH", "SHORT", false);
        for (let i = 0; i < 40; i += 1) {
          AbstractDungeon.effectsQueue.push(new BlurWaveChaoticEffect(this.x, this.y, this.color.cpy(), speed));
        }
        break;
    }
    this.isDone = true;
  }

  render(): void {}
}
