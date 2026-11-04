import { ImageMaster } from "../assets";
import type { SpriteBatch } from "../batch";
import { AbstractGameEffect } from "../effect";
import { Color, GL_ONE, GL_ONE_MINUS_SRC_ALPHA, GL_SRC_ALPHA, Interpolation } from "../gdx";
import { Gdx, Settings } from "../world";

/** vfx/combat/WebParticleEffect. */
export class WebParticleEffect extends AbstractGameEffect {
  private x: number;
  private y: number;

  constructor(x: number, y: number) {
    super();
    this.x = x - 32;
    this.y = y - 32;
    this.startingDuration = 1;
    this.duration = this.startingDuration;
    this.scale = 0.01;
    this.color = new Color(1, 1, 1, 0);
    this.renderBehind = false;
  }

  update(): void {
    this.duration -= Gdx.graphics.getDeltaTime();
    if (this.duration > this.startingDuration / 2) {
      this.color.a =
        Interpolation.fade.apply(1, 0.01, this.duration - this.startingDuration / 2) * Settings.scale;
    } else {
      this.color.a =
        Interpolation.fade.apply(0.01, 1, this.duration / (this.startingDuration / 2)) * Settings.scale;
    }
    this.scale = Interpolation.elasticIn.apply(2.5, 0.01, this.duration / this.startingDuration) * Settings.scale;
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
