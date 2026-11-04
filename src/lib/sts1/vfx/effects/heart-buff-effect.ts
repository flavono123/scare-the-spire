import { AbstractGameEffect } from "../effect";
import { MathUtils } from "../gdx";
import { AbstractDungeon, CardCrawlGame, Gdx, Settings } from "../world";
import { SwirlyBloodEffect } from "./swirly-blood-effect";

/** vfx/combat/HeartBuffEffect. */
export class HeartBuffEffect extends AbstractGameEffect {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    super();
    this.x = x;
    this.y = y;
    this.duration = 0.5;
    this.scale = 0;
  }

  update(): void {
    if (this.duration === 0.5) {
      CardCrawlGame.sound.playA("BUFF_2", -0.6);
    }
    this.scale -= Gdx.graphics.getDeltaTime();
    if (this.scale < 0) {
      this.scale = 0.05;
      AbstractDungeon.effectsQueue.push(
        new SwirlyBloodEffect(
          this.x + MathUtils.random(-150, 150) * Settings.scale,
          this.y + MathUtils.random(-150, 150) * Settings.scale,
        ),
      );
      AbstractDungeon.effectsQueue.push(
        new SwirlyBloodEffect(
          this.x + MathUtils.random(-150, 150) * Settings.scale,
          this.y + MathUtils.random(-150, 150) * Settings.scale,
        ),
      );
    }
    this.duration -= Gdx.graphics.getDeltaTime();
    if (this.duration < 0) this.isDone = true;
  }

  render(): void {}
}
