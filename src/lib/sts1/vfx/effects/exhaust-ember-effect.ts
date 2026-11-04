import type { AtlasRegion } from "../assets";
import { ImageMaster } from "../assets";
import type { SpriteBatch } from "../batch";
import { AbstractGameEffect } from "../effect";
import { Color, GL_ONE, GL_ONE_MINUS_SRC_ALPHA, GL_SRC_ALPHA, Interpolation, MathUtils } from "../gdx";
import { Gdx, Settings } from "../world";

/** vfx/ExhaustEmberEffect. */
export class ExhaustEmberEffect extends AbstractGameEffect {
  private x: number;
  private y: number;
  private vX: number;
  private vY: number;
  private startDur: number;
  private targetScale: number;
  private img: AtlasRegion;
  private rotateSpeed = 0;

  constructor(x: number, y: number) {
    super();
    switch (MathUtils.randomInt(2)) {
      case 0:
        this.color = Color.CORAL.cpy();
        break;
      case 1:
        this.color = Color.ORANGE.cpy();
        break;
      case 2:
        this.color = Color.SCARLET.cpy();
        break;
    }
    this.duration = MathUtils.random(0.6, 1.4);
    this.duration *= this.duration;
    this.targetScale = MathUtils.random(0.4, 0.8);
    this.startDur = this.duration;
    this.vX = MathUtils.random(-150 * Settings.scale, 150 * Settings.scale);
    this.vY = MathUtils.random(-100 * Settings.scale, 300 * Settings.scale);
    this.x = x + MathUtils.random(-170 * Settings.scale, 170 * Settings.scale);
    this.y = y + MathUtils.random(-220 * Settings.scale, 150 * Settings.scale);
    this.scale = 0.01;
    this.img = this.setImg();
    this.rotateSpeed = MathUtils.random(-700, 700);
  }

  private setImg(): AtlasRegion {
    switch (MathUtils.randomInt(0, 5)) {
      case 0:
        return ImageMaster.DUST_1;
      case 1:
        return ImageMaster.DUST_2;
      case 2:
        return ImageMaster.DUST_3;
      case 3:
        return ImageMaster.DUST_4;
      case 4:
        return ImageMaster.DUST_5;
      default:
        return ImageMaster.DUST_6;
    }
  }

  update(): void {
    this.duration -= Gdx.graphics.getDeltaTime();
    if (this.duration < 0) this.isDone = true;
    this.x += this.vX * Gdx.graphics.getDeltaTime();
    this.y += this.vY * Gdx.graphics.getDeltaTime();
    this.rotation += this.rotateSpeed * Gdx.graphics.getDeltaTime();
    this.scale = Interpolation.swing.apply(0.01, this.targetScale, 1 - this.duration / this.startDur);
    if (this.duration < 0.5) this.color.a = this.duration * 2;
  }

  render(sb: SpriteBatch): void {
    sb.setColor(this.color);
    sb.draw(this.img, this.x, this.y, this.img.offsetX, this.img.offsetY, this.img.packedWidth, this.img.packedHeight,
      this.scale, this.scale, this.rotation);
    sb.setColor(new Color(this.color.r, this.color.g, this.color.b, this.color.a / 3));
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE);
    sb.draw(this.img, this.x, this.y, this.img.offsetX, this.img.offsetY, this.img.packedWidth, this.img.packedHeight,
      this.scale, this.scale, this.rotation);
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
  }

  dispose(): void {}
}
