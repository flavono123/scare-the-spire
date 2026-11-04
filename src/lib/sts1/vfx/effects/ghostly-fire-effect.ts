import type { AtlasRegion } from "../assets";
import { ImageMaster } from "../assets";
import type { SpriteBatch } from "../batch";
import { AbstractGameEffect } from "../effect";
import { Color, GL_ONE, GL_ONE_MINUS_SRC_ALPHA, GL_SRC_ALPHA, MathUtils } from "../gdx";
import { Gdx, Settings } from "../world";

const DUR = 1;

/** vfx/GhostlyFireEffect. */
export class GhostlyFireEffect extends AbstractGameEffect {
  private img: AtlasRegion;
  private x: number;
  private y: number;
  private vX: number;
  private vY: number;

  constructor(x: number, y: number) {
    super();
    this.img = this.getImg();
    this.x = x + MathUtils.random(-2, 2) * Settings.scale - this.img.packedWidth / 2;
    this.y = y + MathUtils.random(-2, 2) * Settings.scale - this.img.packedHeight / 2;
    this.vX = MathUtils.random(-10, 10) * Settings.scale;
    this.vY = MathUtils.random(20, 150) * Settings.scale;
    this.duration = DUR;
    this.color = Color.CHARTREUSE.cpy();
    this.color.a = 0;
    this.scale = Settings.scale * MathUtils.random(5, 6);
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
    this.x += this.vX * Gdx.graphics.getDeltaTime();
    this.y += this.vY * Gdx.graphics.getDeltaTime();
    this.duration -= Gdx.graphics.getDeltaTime();
    if (this.duration < 0) {
      this.isDone = true;
    }
    if (this.scale > 0.1) {
      this.scale -= Gdx.graphics.getDeltaTime() / 4;
    }
    this.color.a = this.duration / 2;
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
      this.scale * MathUtils.random(0.95, 1.05),
      this.scale * MathUtils.random(0.95, 1.05),
      this.rotation,
    );
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
  }

  dispose(): void {}
}
