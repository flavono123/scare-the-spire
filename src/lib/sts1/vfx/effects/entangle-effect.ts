import { ImageMaster } from "../assets";
import type { SpriteBatch } from "../batch";
import { AbstractGameEffect } from "../effect";
import { Color, GL_ONE, GL_ONE_MINUS_SRC_ALPHA, GL_SRC_ALPHA, Interpolation } from "../gdx";
import { Gdx, Settings } from "../world";

/** vfx/combat/EntangleEffect. Flies from `(x, y)` to `(dX, dY)`. */
export class EntangleEffect extends AbstractGameEffect {
  x: number;
  y: number;
  dX: number;
  dY: number;
  tX: number;
  tY: number;

  constructor(x: number, y: number, dX: number, dY: number) {
    super();
    this.tX = x - 32;
    this.tY = y - 32;
    this.dX = dX - 32;
    this.dY = dY - 32;
    this.x = dX;
    this.y = dY;
    this.startingDuration = 1;
    this.duration = this.startingDuration;
    this.scale = 0.01;
    this.color = new Color(1, 1, 1, 0);
    this.renderBehind = false;
  }

  update(): void {
    this.duration -= Gdx.graphics.getDeltaTime();
    this.x = Interpolation.pow5In.apply(this.dX, this.tX, this.duration);
    this.y = Interpolation.pow5In.apply(this.dY, this.tY, this.duration);
    if (this.duration > this.startingDuration / 2) {
      this.color.a =
        Interpolation.fade.apply(1, 0.01, this.duration - this.startingDuration / 2) * Settings.scale;
    } else {
      this.color.a =
        Interpolation.fade.apply(0.01, 1, this.duration / (this.startingDuration / 2)) * Settings.scale;
    }
    this.scale = Interpolation.bounceIn.apply(5, 1, this.duration) * Settings.scale;
    if (this.duration < 0) {
      this.isDone = true;
    }
  }

  render(sb: SpriteBatch): void {
    sb.setColor(new Color(1, 1, 1, this.color.a));
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE);
    sb.draw(
      ImageMaster.WEB_VFX,
      this.x,
      this.y,
      32,
      32,
      64,
      64,
      this.scale,
      this.scale,
      0,
      0,
      0,
      64,
      64,
      false,
      false,
    );
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
  }

  dispose(): void {}
}
