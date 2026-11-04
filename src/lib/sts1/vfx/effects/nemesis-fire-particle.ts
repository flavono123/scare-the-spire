import type { AtlasRegion } from "../assets";
import { ImageMaster } from "../assets";
import type { SpriteBatch } from "../batch";
import { AbstractGameEffect } from "../effect";
import { Color, Interpolation, MathUtils } from "../gdx";
import { Gdx, Settings } from "../world";

/** vfx/NemesisFireParticle. */
export class NemesisFireParticle extends AbstractGameEffect {
  private x: number;
  private y: number;
  private vY: number;
  private img: AtlasRegion;

  constructor(x: number, y: number) {
    super();
    this.duration = MathUtils.random(0.5, 1);
    this.startingDuration = this.duration;
    this.img = this.getImg();
    this.x = x - Math.trunc(this.img.packedWidth / 2);
    this.y = y - Math.trunc(this.img.packedHeight / 2);
    this.scale = Settings.scale * MathUtils.random(0.25, 0.5);
    this.vY = MathUtils.random(1, 10) * Settings.scale;
    this.vY *= this.vY;
    this.rotation = MathUtils.random(-20, 20);
    this.color = new Color(0.1, 0.2, 0.1, 0.01);
  }

  private getImg(): AtlasRegion {
    switch (MathUtils.randomInt(0, 2)) {
      case 0:
        return ImageMaster.TORCH_FIRE_1;
      case 1:
        return ImageMaster.TORCH_FIRE_2;
      default:
        return ImageMaster.TORCH_FIRE_3;
    }
  }

  update(): void {
    this.duration -= Gdx.graphics.getDeltaTime();
    if (this.duration < 0) {
      this.isDone = true;
    }
    this.color.a = Interpolation.fade.apply(0, 1, this.duration / this.startingDuration);
    this.y += this.vY * Gdx.graphics.getDeltaTime();
  }

  render(sb: SpriteBatch): void {
    sb.setColor(this.color);
    sb.draw(
      this.img,
      this.x,
      this.y,
      this.img.packedWidth / 2,
      this.img.packedHeight / 2,
      this.img.packedWidth,
      this.img.packedHeight,
      this.scale,
      this.scale,
      this.rotation,
    );
  }

  dispose(): void {}
}
