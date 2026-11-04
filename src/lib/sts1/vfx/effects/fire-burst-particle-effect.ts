import type { AtlasRegion } from "../assets";
import { ImageMaster } from "../assets";
import type { SpriteBatch } from "../batch";
import { AbstractGameEffect } from "../effect";
import { Color, GL_ONE, GL_ONE_MINUS_SRC_ALPHA, GL_SRC_ALPHA, Interpolation, MathUtils } from "../gdx";
import { Gdx, Settings } from "../world";

const DUR = 1;
const GRAVITY = 180 * Settings.scale;

/** vfx/FireBurstParticleEffect. */
export class FireBurstParticleEffect extends AbstractGameEffect {
  private img: AtlasRegion;
  private x: number;
  private y: number;
  private vX: number;
  private vY: number;
  private floor: number;

  constructor(x: number, y: number) {
    super();
    const roll = MathUtils.randomInt(0, 2);
    if (roll === 0) {
      this.img = ImageMaster.TORCH_FIRE_1;
    } else if (roll === 1) {
      this.img = ImageMaster.TORCH_FIRE_2;
    } else {
      this.img = ImageMaster.TORCH_FIRE_3;
    }
    this.duration = MathUtils.random(0.5, DUR);
    this.x = x - Math.trunc(this.img.packedWidth / 2);
    this.y = y - Math.trunc(this.img.packedHeight / 2);
    this.color = new Color(MathUtils.random(0.1, 0.3), MathUtils.random(0.8, 1), MathUtils.random(0.1, 0.3), 0);
    this.color.a = 0;
    this.rotation = MathUtils.random(-10, 10);
    this.scale = MathUtils.random(2, 4) * Settings.scale;
    this.vX = MathUtils.random(-900, 900) * Settings.scale;
    this.vY = MathUtils.random(0, 500) * Settings.scale;
    this.floor = MathUtils.random(100, 250) * Settings.scale;
  }

  update(): void {
    this.vY += (GRAVITY / this.scale) * Gdx.graphics.getDeltaTime();
    this.x += this.vX * Gdx.graphics.getDeltaTime() * MathUtils.sinDeg(Gdx.graphics.getDeltaTime());
    this.y += this.vY * Gdx.graphics.getDeltaTime();
    if (this.scale > 0.3 * Settings.scale) this.scale -= Gdx.graphics.getDeltaTime() * 2;
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
    if (this.duration < 0) this.isDone = true;
  }

  render(sb: SpriteBatch): void {
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE);
    sb.setColor(this.color);
    sb.draw(this.img, this.x, this.y, this.img.packedWidth / 2, this.img.packedHeight / 2, this.img.packedWidth,
      this.img.packedHeight, this.scale, this.scale, this.rotation);
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
  }

  dispose(): void {}
}
