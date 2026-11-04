import type { SpriteBatch } from "../batch";
import type { AtlasRegion } from "../assets";
import { ImageMaster } from "../assets";
import { AbstractGameEffect } from "../effect";
import { Color, GL_ONE, GL_ONE_MINUS_SRC_ALPHA, GL_SRC_ALPHA, Interpolation, MathUtils } from "../gdx";
import { Gdx, Settings } from "../world";

/** vfx/combat/IntenseZoomParticle. */
export class IntenseZoomParticle extends AbstractGameEffect {
  private x: number;
  private y: number;
  private img: AtlasRegion;
  private offsetX = 0;
  private flickerDuration = 0;
  private lengthX = 0;
  private lengthY = 0;
  private isBlack = false;

  constructor(x: number, y: number, isBlack: boolean) {
    super();
    const roll = MathUtils.randomInt(2);
    if (roll === 0) {
      this.img = ImageMaster.CONE_2;
    } else if (roll === 1) {
      this.img = ImageMaster.CONE_4;
    } else {
      this.img = ImageMaster.CONE_5;
    }
    this.duration = 1.5;
    this.isBlack = isBlack;
    if (isBlack) {
      this.color = Color.BLACK.cpy();
    } else {
      this.color = Settings.GOLD_COLOR.cpy();
    }
    this.x = x;
    this.y = y - this.img.packedHeight / 2;
    this.randomize();
  }

  update(): void {
    this.flickerDuration -= Gdx.graphics.getDeltaTime();
    if (this.flickerDuration < 0) {
      this.randomize();
      this.flickerDuration = MathUtils.random(0, 0.05);
    }
    this.duration -= Gdx.graphics.getDeltaTime();
    if (this.duration < 0) this.isDone = true;
  }

  randomize(): void {
    this.rotation = MathUtils.random(360);
    this.offsetX = MathUtils.random(200, 600) * Settings.scale * (2 - this.duration);
    this.lengthX = MathUtils.random(1, 1.3);
    this.lengthY = MathUtils.random(0.9, 1.2);
    if (this.isBlack) {
      this.color.a = MathUtils.random(0.5, 1) * Interpolation.pow2Out.apply(this.duration / 1.5);
    } else {
      this.color.a = MathUtils.random(0.2, 0.7) * Interpolation.pow2Out.apply(this.duration / 1.5);
    }
  }

  render(sb: SpriteBatch): void {
    if (!this.isBlack) sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE);
    sb.setColor(this.color);
    sb.draw(
      this.img,
      this.x + this.offsetX,
      this.y,
      -this.offsetX,
      this.img.packedHeight / 2,
      this.img.packedWidth * this.lengthX,
      this.img.packedHeight * this.lengthY,
      this.scale,
      this.scale,
      this.rotation,
    );
    if (!this.isBlack) sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
  }
}
