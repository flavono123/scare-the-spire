import type { AtlasRegion } from "../assets";
import { ImageMaster } from "../assets";
import type { SpriteBatch } from "../batch";
import { AbstractGameEffect } from "../effect";
import { Color, GL_ONE, GL_ONE_MINUS_SRC_ALPHA, GL_SRC_ALPHA, Interpolation, MathUtils } from "../gdx";
import { Gdx, Settings } from "../world";

/** vfx/AwakenedEyeParticle. */
export class AwakenedEyeParticle extends AbstractGameEffect {
  private x: number;
  private y: number;
  private img: AtlasRegion;

  constructor(x: number, y: number) {
    super();
    this.duration = MathUtils.random(0.5, 1);
    this.startingDuration = this.duration;
    this.img = ImageMaster.ROOM_SHINE_2;
    this.x = x - Math.trunc(this.img.packedWidth / 2);
    this.y = y - Math.trunc(this.img.packedHeight / 2);
    this.scale = Settings.scale * MathUtils.random(0.5, 1);
    this.rotation = 0;
    this.color = new Color(MathUtils.random(0.2, 0.4), MathUtils.random(0.8, 1), MathUtils.random(0.8, 1), 0.01);
  }

  update(): void {
    this.duration -= Gdx.graphics.getDeltaTime();
    if (this.duration < 0) {
      this.isDone = true;
    }
    this.color.a = Interpolation.fade.apply(0, 0.5, this.duration / this.startingDuration);
  }

  render(sb: SpriteBatch): void {
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE);
    sb.setColor(this.color);
    sb.draw(
      this.img,
      this.x,
      this.y,
      this.img.packedWidth / 2,
      this.img.packedHeight / 2,
      this.img.packedWidth,
      this.img.packedHeight,
      this.scale * MathUtils.random(6, 12),
      this.scale * MathUtils.random(0.7, 0.8),
      this.rotation + MathUtils.random(-1, 1),
    );
    sb.draw(
      this.img,
      this.x,
      this.y,
      this.img.packedWidth / 2,
      this.img.packedHeight / 2,
      this.img.packedWidth,
      this.img.packedHeight,
      this.scale * MathUtils.random(0.2, 0.5),
      this.scale * MathUtils.random(2, 3),
      this.rotation + MathUtils.random(-1, 1),
    );
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
  }

  dispose(): void {}
}
