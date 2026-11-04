import type { AtlasRegion } from "../assets";
import { ImageMaster } from "../assets";
import type { SpriteBatch } from "../batch";
import { AbstractGameEffect } from "../effect";
import { Color, GL_ONE, GL_ONE_MINUS_SRC_ALPHA, GL_SRC_ALPHA, Interpolation, MathUtils } from "../gdx";
import { Gdx, Settings } from "../world";

/**
 * vfx/AwakenedWingParticle. The Awakened One keeps these itself and draws
 * them with `render(sb, x, y)` at its wing bones; `render(sb)` draws nothing.
 */
export class AwakenedWingParticle extends AbstractGameEffect {
  private x: number;
  private y: number;
  private tScale = 0;
  private img: AtlasRegion;

  constructor() {
    super();
    this.duration = 2;
    this.startingDuration = this.duration;
    this.img = ImageMaster.THICK_3D_LINE_2;
    this.scale = 0.01;
    this.rotation = MathUtils.random(25, 85);
    this.renderBehind = MathUtils.randomBoolean(0.2);
    if (this.renderBehind) {
      this.tScale = MathUtils.random(0.8, 1.2);
    }
    this.color = new Color(0.3, 0.3, MathUtils.random(0.3, 0.35), MathUtils.random(0.5, 0.9));
    const roll = MathUtils.randomInt(0, 2);
    if (roll === 0) {
      this.x = MathUtils.random(-340, -170) * Settings.scale;
      this.y = MathUtils.random(-20, 20) * Settings.scale;
      this.tScale = MathUtils.random(0.4, 0.5);
    } else if (roll === 1) {
      this.x = MathUtils.random(-220, -20) * Settings.scale;
      this.y = MathUtils.random(-40, -10) * Settings.scale;
      this.tScale = MathUtils.random(0.4, 0.5);
    } else {
      this.x = MathUtils.random(-270, -60) * Settings.scale;
      this.y = MathUtils.random(-30, -0) * Settings.scale;
      this.tScale = MathUtils.random(0.4, 0.7);
    }
    this.x += 155 * Settings.scale;
    this.y += 30 * Settings.scale;
    this.x -= Math.trunc(this.img.packedWidth / 2);
    this.y -= Math.trunc(this.img.packedHeight / 2);
  }

  update(): void {
    this.duration -= Gdx.graphics.getDeltaTime();
    if (this.duration < 0) {
      this.isDone = true;
    }
    if (this.duration > 1) {
      this.scale = Interpolation.bounceIn.apply(this.tScale, 0.01, this.duration - 1) * Settings.scale;
    }
    if (this.duration < 0.2) {
      this.color.a = Interpolation.fade.apply(0, 0.5, this.duration * 5);
    }
  }

  /** `render(sb)` (empty) and `render(sb, x, y)`, which draws offset by the wing's position. */
  render(sb: SpriteBatch): void;
  render(sb: SpriteBatch, x: number, y: number): void;
  render(sb: SpriteBatch, x?: number, y?: number): void {
    if (x === undefined || y === undefined) return;
    const rotationJitter = MathUtils.random(3, 5);
    sb.setColor(new Color(0.4, 1, 1, this.color.a / 2));
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE);
    sb.draw(
      this.img,
      this.x + x,
      this.y + y,
      this.img.packedWidth * 0.08,
      this.img.packedHeight / 2,
      this.img.packedWidth,
      this.img.packedHeight,
      this.scale * MathUtils.random(1.1, 1.25),
      this.scale,
      this.rotation + rotationJitter,
    );
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
    sb.setColor(this.color);
    sb.draw(
      this.img,
      this.x + x,
      this.y + y,
      this.img.packedWidth * 0.08,
      this.img.packedHeight / 2,
      this.img.packedWidth,
      this.img.packedHeight,
      this.scale,
      this.scale,
      this.rotation + rotationJitter,
    );
    sb.setColor(new Color(0, 0, 0, this.color.a / 5));
    sb.draw(
      this.img,
      this.x + x,
      this.y + y,
      this.img.packedWidth * 0.08,
      this.img.packedHeight / 2,
      this.img.packedWidth,
      this.img.packedHeight,
      this.scale * 0.7,
      this.scale * 0.7,
      this.rotation + rotationJitter - 40,
    );
  }

  dispose(): void {}
}
