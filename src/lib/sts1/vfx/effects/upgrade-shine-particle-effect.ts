import type { AtlasRegion } from "../assets";
import { ImageMaster } from "../assets";
import type { SpriteBatch } from "../batch";
import { AbstractGameEffect } from "../effect";
import { Color, GL_ONE, GL_ONE_MINUS_SRC_ALPHA, GL_SRC_ALPHA, Interpolation, MathUtils, Vector2 } from "../gdx";
import { Gdx, Settings } from "../world";

const GRAVITY = 3000 * Settings.scale;

/** vfx/UpgradeShineParticleEffect. */
export class UpgradeShineParticleEffect extends AbstractGameEffect {
  private static readonly DUR = 1;
  private img: AtlasRegion;
  private x = 0;
  private y = 0;
  private vX = 0;
  private vY = 0;
  private floor = 0;

  constructor(x: number, y: number) {
    super();
    if (MathUtils.randomBoolean()) {
      this.img = ImageMaster.STRIKE_LINE_2;
    } else {
      this.img = ImageMaster.GLOW_SPARK_2;
    }
    this.duration = MathUtils.random(0.5, 1);
    this.x = x - Math.trunc(this.img.packedWidth / 2);
    this.y = y - Math.trunc(this.img.packedHeight / 2);
    this.color = new Color(MathUtils.random(0.5, 1), MathUtils.random(0.4, 0.6), MathUtils.random(0, 0.2), 0);
    this.color.a = 0;
    this.rotation = MathUtils.random(0, 360);
    this.scale = MathUtils.random(0.5, 2) * Settings.scale;
    this.vX = MathUtils.random(-900, 900) * Settings.scale;
    this.vY = MathUtils.random(-500, 1000) * Settings.scale;
    this.floor = MathUtils.random(100, 250) * Settings.scale;
  }

  update(): void {
    this.vY -= (GRAVITY / this.scale) * Gdx.graphics.getDeltaTime();
    this.x += this.vX * Gdx.graphics.getDeltaTime();
    this.y += this.vY * Gdx.graphics.getDeltaTime();
    const test = new Vector2(this.vX, this.vY);
    this.rotation = test.angle();
    if (this.y < this.floor) {
      this.vY = -this.vY * 0.75;
      this.y = this.floor + 0.1;
      this.vX *= 1.1;
    }
    if (1 - this.duration < 0.1) {
      this.color.a = Interpolation.fade.apply(0, 1, (1 - this.duration) * 10);
    } else {
      this.color.a = Interpolation.pow2Out.apply(0, 1, this.duration);
    }
    this.duration -= Gdx.graphics.getDeltaTime();
    if (this.duration < 0) {
      this.isDone = true;
    }
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
      this.scale * MathUtils.random(0.7, 1.3),
      this.scale * MathUtils.random(0.7, 1.3),
      this.rotation,
    );
    sb.draw(
      this.img,
      this.x,
      this.y,
      this.img.packedWidth / 2,
      this.img.packedHeight / 2,
      this.img.packedWidth,
      this.img.packedHeight,
      this.scale * MathUtils.random(0.7, 1.3),
      this.scale * MathUtils.random(0.7, 1.3),
      this.rotation,
    );
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
  }

  dispose(): void {}
}
