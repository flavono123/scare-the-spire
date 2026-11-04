import { AbstractGameEffect } from "../effect";
import { Color } from "../gdx";
import { AbstractDungeon, CardCrawlGame, Gdx } from "../world";
import { BorderLongFlashEffect } from "./border-long-flash-effect";
import { GiantFireEffect } from "./giant-fire-effect";

const INTERVAL = 0.05;

/** vfx/combat/ScreenOnFireEffect. */
export class ScreenOnFireEffect extends AbstractGameEffect {
  private timer = 0;

  constructor() {
    super();
    this.duration = 3;
    this.startingDuration = this.duration;
  }

  update(): void {
    if (this.duration === this.startingDuration) {
      CardCrawlGame.sound.play("GHOST_FLAMES");
      AbstractDungeon.effectsQueue.push(new BorderLongFlashEffect(Color.FIREBRICK));
    }
    this.duration -= Gdx.graphics.getDeltaTime();
    this.timer -= Gdx.graphics.getDeltaTime();
    if (this.timer < 0) {
      AbstractDungeon.effectsQueue.push(new GiantFireEffect());
      AbstractDungeon.effectsQueue.push(new GiantFireEffect());
      AbstractDungeon.effectsQueue.push(new GiantFireEffect());
      AbstractDungeon.effectsQueue.push(new GiantFireEffect());
      AbstractDungeon.effectsQueue.push(new GiantFireEffect());
      AbstractDungeon.effectsQueue.push(new GiantFireEffect());
      AbstractDungeon.effectsQueue.push(new GiantFireEffect());
      AbstractDungeon.effectsQueue.push(new GiantFireEffect());
      this.timer = INTERVAL;
    }
    if (this.duration < 0) this.isDone = true;
  }

  render(): void {}
}
