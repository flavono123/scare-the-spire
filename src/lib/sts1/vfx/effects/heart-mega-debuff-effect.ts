import type { SpriteBatch } from "../batch";
import { ImageMaster } from "../assets";
import { AbstractGameEffect } from "../effect";
import { Color, Interpolation } from "../gdx";
import { CardCrawlGame, Gdx, Settings } from "../world";

/** vfx/combat/HeartMegaDebuffEffect. */
export class HeartMegaDebuffEffect extends AbstractGameEffect {
  constructor() {
    super();
    this.startingDuration = 4;
    this.duration = this.startingDuration;
    this.color = new Color(0.9, 0.7, 1, 0);
    this.renderBehind = true;
  }

  update(): void {
    if (this.duration === this.startingDuration) {
      CardCrawlGame.sound.playA("GHOST_ORB_IGNITE_1", -0.6);
    }
    if (this.duration > this.startingDuration / 2) {
      this.color.a = Interpolation.bounceIn.apply(
        1,
        0,
        (this.duration - this.startingDuration / 2) / (this.startingDuration / 2),
      );
    } else {
      // The game multiplies here (duration * 2), so alpha holds at 1 until about the last half second.
      this.color.a = Interpolation.bounceOut.apply(this.duration * (this.startingDuration / 2));
    }
    this.duration -= Gdx.graphics.getDeltaTime();
    if (this.duration < 0) this.isDone = true;
  }

  render(sb: SpriteBatch): void {
    sb.setColor(new Color(0, 0, 0, this.color.a * 0.8));
    sb.draw(ImageMaster.WHITE_SQUARE_IMG, 0, 0, Settings.WIDTH, Settings.HEIGHT);
    sb.setColor(this.color);
    sb.draw(ImageMaster.BORDER_GLOW_2, 0, 0, Settings.WIDTH, Settings.HEIGHT);
  }
}
