import { AbstractGameEffect } from "../effect";
import { AbstractDungeon, CardCrawlGame, Gdx } from "../world";
import { SmokeBlurEffect } from "./smoke-blur-effect";

/** vfx/combat/SmokeBombEffect. */
export class SmokeBombEffect extends AbstractGameEffect {
  private x: number;
  private y: number;

  constructor(x: number, y: number) {
    super();
    this.x = x;
    this.y = y;
    this.duration = 0.2;
  }

  update(): void {
    if (this.duration === 0.2) {
      CardCrawlGame.sound.play("ATTACK_WHIFF_2");
      for (let i = 0; i < 90; i++) {
        AbstractDungeon.effectsQueue.push(new SmokeBlurEffect(this.x, this.y));
      }
    }
    this.duration -= Gdx.graphics.getDeltaTime();
    if (this.duration < 0) {
      CardCrawlGame.sound.play("APPEAR");
      this.isDone = true;
    }
  }

  render(): void {}

  dispose(): void {}
}
