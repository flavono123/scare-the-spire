import type { AtlasRegion } from "../assets";
import { ImageMaster } from "../assets";
import type { SpriteBatch } from "../batch";
import { AbstractGameEffect } from "../effect";
import { Color, Interpolation, MathUtils } from "../gdx";
import { Gdx, Settings } from "../world";

/** vfx/combat/SmokeBlurEffect. */
export class SmokeBlurEffect extends AbstractGameEffect {
  private x: number;
  private y: number;
  private vY: number;
  private aV: number;
  private startDur: number;
  private targetScale: number;
  private img: AtlasRegion;

  constructor(x: number, y: number) {
    super();
    this.color = new Color(0, 0, 0, 1);
    this.color.r = MathUtils.random(0.5, 0.6);
    this.color.g = this.color.r + MathUtils.random(0, 0.2);
    this.color.b = 0.2;
    if (MathUtils.randomBoolean()) {
      this.img = ImageMaster.EXHAUST_L;
      this.duration = MathUtils.random(2, 2.5);
      this.targetScale = MathUtils.random(0.8, 2.2);
    } else {
      this.img = ImageMaster.EXHAUST_S;
      this.duration = MathUtils.random(2, 2.5);
      this.targetScale = MathUtils.random(0.8, 1.2);
    }
    this.startDur = this.duration;
    this.x = x + MathUtils.random(-180 * Settings.scale, 150 * Settings.scale) - this.img.packedWidth / 2;
    this.y = y + MathUtils.random(-240 * Settings.scale, 150 * Settings.scale) - this.img.packedHeight / 2;
    this.scale = 0.01;
    this.rotation = MathUtils.random(360);
    this.aV = MathUtils.random(-250, 250);
    this.vY = MathUtils.random(1 * Settings.scale, 5 * Settings.scale);
  }

  update(): void {
    this.duration -= Gdx.graphics.getDeltaTime();
    if (this.duration < 0) {
      this.isDone = true;
    }
    this.x += MathUtils.random(-2 * Settings.scale, 2 * Settings.scale);
    this.x += this.vY;
    this.y += MathUtils.random(-2 * Settings.scale, 2 * Settings.scale);
    this.y += this.vY;
    this.rotation += this.aV * Gdx.graphics.getDeltaTime();
    this.scale = Interpolation.exp10Out.apply(0.01, this.targetScale, 1 - this.duration / this.startDur);
    if (this.duration < 0.33) {
      this.color.a = this.duration * 3;
    }
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
