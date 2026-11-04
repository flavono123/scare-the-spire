import { AbstractGameEffect } from "../effect";
import { Color, MathUtils } from "../gdx";
import { AbstractDungeon, CardCrawlGame, Gdx, Settings } from "../world";
import { BorderLongFlashEffect } from "./border-long-flash-effect";
import { CollectorStakeEffect } from "./collector-stake-effect";
import { RoomTintEffect } from "./room-tint-effect";

/** vfx/CollectorCurseEffect. */
export class CollectorCurseEffect extends AbstractGameEffect {
  private x: number;
  private y: number;
  private count: number;
  private stakeTimer = 0;

  constructor(x: number, y: number) {
    super();
    this.x = x;
    this.y = y;
    this.count = 13;
  }

  update(): void {
    this.stakeTimer -= Gdx.graphics.getDeltaTime();
    if (this.stakeTimer < 0) {
      if (this.count === 13) {
        CardCrawlGame.sound.playA("ATTACK_HEAVY", -0.5);
        AbstractDungeon.effectsQueue.push(new RoomTintEffect(Color.BLACK.cpy(), 0.8));
        AbstractDungeon.effectsQueue.push(new BorderLongFlashEffect(new Color(1, 0, 1, 0.7)));
      }
      AbstractDungeon.effectsQueue.push(new CollectorStakeEffect(
        this.x + MathUtils.random(-50, 50) * Settings.scale,
        this.y + MathUtils.random(-60, 60) * Settings.scale,
      ));
      this.stakeTimer = 0.04;
      this.count -= 1;
      if (this.count === 0) this.isDone = true;
    }
  }

  render(): void {}

  dispose(): void {}
}
