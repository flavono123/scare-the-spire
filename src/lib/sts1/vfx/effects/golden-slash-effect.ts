import { AbstractGameEffect } from "../effect";
import { Color } from "../gdx";
import { AbstractDungeon, CardCrawlGame, Settings } from "../world";
import { AnimatedSlashEffect } from "./animated-slash-effect";

/** vfx/combat/GoldenSlashEffect: queues one gold AnimatedSlashEffect and finishes. */
export class GoldenSlashEffect extends AbstractGameEffect {
  private x = 0;
  private y = 0;
  private isVertical = false;

  constructor(x: number, y: number, isVertical: boolean) {
    super();
    this.x = x;
    this.y = y;
    this.startingDuration = 0.1;
    this.duration = this.startingDuration;
    this.isVertical = isVertical;
  }

  update(): void {
    CardCrawlGame.sound.playA("ATTACK_IRON_2", -0.4);
    CardCrawlGame.sound.playA("ATTACK_HEAVY", -0.4);
    if (this.isVertical) {
      AbstractDungeon.effectsQueue.push(
        new AnimatedSlashEffect(this.x, this.y - 30 * Settings.scale, 0, -500, 180, 5, Color.GOLD, Color.GOLD),
      );
    } else {
      AbstractDungeon.effectsQueue.push(
        new AnimatedSlashEffect(this.x, this.y - 30 * Settings.scale, -500, -500, 135, 4, Color.GOLD, Color.GOLD),
      );
    }
    this.isDone = true;
  }

  render(): void {}

  dispose(): void {}
}
