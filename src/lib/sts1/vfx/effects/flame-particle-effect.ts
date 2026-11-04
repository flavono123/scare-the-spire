import type { AtlasRegion } from "../assets";
import { ImageMaster } from "../assets";
import type { SpriteBatch } from "../batch";
import { AbstractGameEffect } from "../effect";
import { Color, GL_ONE, GL_ONE_MINUS_SRC_ALPHA, GL_SRC_ALPHA, Interpolation, MathUtils } from "../gdx";
import { Gdx, Settings } from "../world";

/**
 * vfx/combat/FlameParticleEffect. The Java class shadows `startingDuration`
 * with a private field; only this class reads it, so the inherited one serves.
 */
export class FlameParticleEffect extends AbstractGameEffect {
  private img!: AtlasRegion;
  private x: number;
  private y: number;
  private vX: number;
  private vY: number;
  private vY2: number;
  private vS: number;
  private flipX: boolean;
  private delayTimer: number;

  constructor(x: number, y: number) {
    super();
    this.flipX = MathUtils.randomBoolean();
    this.delayTimer = MathUtils.random(0.15);
    this.setImg();
    this.startingDuration = MathUtils.random(0.6, 1.5);
    this.duration = this.startingDuration;
    let r = MathUtils.random(-13, 13) * MathUtils.random(-13, 13);
    this.x = x + r * Settings.scale - this.img.packedWidth / 2;
    this.y = y + MathUtils.random(-180, 0) * Settings.scale - this.img.packedHeight / 2;
    this.vX = MathUtils.random(-25, 25) * Settings.scale;
    r = MathUtils.random(3, 30);
    this.vY = ((r * r) / this.startingDuration) * Settings.scale;
    this.vY2 = MathUtils.random(-100, 100) * Settings.scale;
    this.vS = MathUtils.random(-0.5, 0.5) * Settings.scale;
    this.color = new Color(1, 1, 1, 0);
    this.color.g -= MathUtils.random(0.5);
    this.color.b -= this.color.g - MathUtils.random(0.5);
    this.rotation = MathUtils.random(-10, 10);
    this.scale = Settings.scale * MathUtils.random(0.2, 1.5);
    this.renderBehind = MathUtils.randomBoolean(0.5);
  }

  update(): void {
    if (this.delayTimer > 0) {
      this.delayTimer -= Gdx.graphics.getDeltaTime();
      return;
    }
    this.x += this.vX * Gdx.graphics.getDeltaTime();
    this.y += this.vY * Gdx.graphics.getDeltaTime();
    this.vY += this.vY2 * Gdx.graphics.getDeltaTime();
    this.vY *= 59 * Gdx.graphics.getDeltaTime();
    this.scale += this.vS * Gdx.graphics.getDeltaTime();
    this.duration -= Gdx.graphics.getDeltaTime();
    if (this.duration < 0) {
      this.isDone = true;
    } else if (this.duration > this.startingDuration / 2) {
      this.color.a = Interpolation.fade.apply(0, 0.5,
        (this.startingDuration - this.duration) / (this.startingDuration / 2));
    } else if (this.duration < this.startingDuration / 2) {
      this.color.a = Interpolation.fade.apply(0, 0.5, this.duration / (this.startingDuration / 2));
    }
  }

  private setImg(): void {
    const roll = MathUtils.randomInt(2);
    if (roll === 0) {
      this.img = ImageMaster.FLAME_1;
    } else if (roll === 1) {
      this.img = ImageMaster.FLAME_2;
    } else {
      this.img = ImageMaster.FLAME_3;
    }
  }

  render(sb: SpriteBatch): void {
    sb.setColor(this.color);
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE);
    if (this.flipX && !this.img.isFlipX()) {
      this.img.flip(true, false);
    } else if (!this.flipX && this.img.isFlipX()) {
      this.img.flip(true, false);
    }
    sb.draw(this.img, this.x, this.y, this.img.packedWidth / 2, this.img.packedHeight / 2, this.img.packedWidth,
      this.img.packedHeight, this.scale, this.scale, this.rotation);
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
  }

  dispose(): void {}
}
