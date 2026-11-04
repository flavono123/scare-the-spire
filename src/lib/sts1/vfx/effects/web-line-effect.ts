import { ImageMaster } from "../assets";
import type { SpriteBatch } from "../batch";
import { AbstractGameEffect } from "../effect";
import { Color, GL_ONE, GL_ONE_MINUS_SRC_ALPHA, GL_SRC_ALPHA, Interpolation, MathUtils } from "../gdx";
import { Gdx, Settings } from "../world";

/** vfx/combat/WebLineEffect. */
export class WebLineEffect extends AbstractGameEffect {
  x: number;
  y: number;

  constructor(x: number, y: number, facingLeft: boolean) {
    super();
    this.x = x + MathUtils.random(-20, 20) * Settings.scale;
    this.y = y - 128 + MathUtils.random(-10, 10) * Settings.scale;
    this.startingDuration = 1;
    this.duration = this.startingDuration;
    this.rotation = MathUtils.random(185, 170);
    if (!facingLeft) {
      this.rotation += 180;
    }
    this.scale = MathUtils.random(0.8, 1) * Settings.scale;
    const tmp = MathUtils.random(0.6, 0.9);
    this.color = new Color(tmp, tmp, tmp + 0.1, 0);
    this.renderBehind = false;
  }

  update(): void {
    this.duration -= Gdx.graphics.getDeltaTime();
    if (this.duration > this.startingDuration / 2) {
      this.color.a =
        Interpolation.fade.apply(0.8, 0.01, this.duration - this.startingDuration / 2) * Settings.scale;
    } else {
      this.color.a =
        Interpolation.pow5Out.apply(0.01, 0.8, this.duration / (this.startingDuration / 2)) * Settings.scale;
    }
    if (this.duration < 0) {
      this.isDone = true;
    }
  }

  render(sb: SpriteBatch): void {
    sb.setColor(new Color(1, 1, 1, this.color.a));
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE);
    sb.draw(
      ImageMaster.HORIZONTAL_LINE,
      this.x,
      this.y,
      0,
      128,
      256,
      256,
      this.scale * 2 * (MathUtils.cos(this.duration * 16) / 4 + 1.5),
      this.scale,
      this.rotation,
      0,
      0,
      256,
      256,
      false,
      false,
    );
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
  }

  dispose(): void {}
}
