import type { SpriteBatch } from "../batch";
import type { AtlasRegion } from "../assets";
import { ImageMaster } from "../assets";
import { AbstractGameEffect } from "../effect";
import { Color, GL_ONE, GL_ONE_MINUS_SRC_ALPHA, GL_SRC_ALPHA, Interpolation, MathUtils, Vector2 } from "../gdx";
import { Gdx, Settings } from "../world";

const EFFECT_DUR = 2;

/** vfx/combat/BlurWaveAdditiveEffect. */
export class BlurWaveAdditiveEffect extends AbstractGameEffect {
  private x: number;
  private y: number;
  private speed: number;
  private speedStart: number;
  private speedTarget: number;
  private stallTimer: number;
  private img: AtlasRegion;
  private flipper: number;

  constructor(x: number, y: number, color: Color, chosenSpeed: number) {
    super();
    this.img = ImageMaster.BLUR_WAVE;
    this.stallTimer = MathUtils.random(0, 0.3);
    this.rotation = MathUtils.random(360);
    this.scale = MathUtils.random(0.5, 0.9);
    this.x = x - this.img.packedWidth / 2;
    this.y = y - this.img.packedHeight / 2;
    this.duration = EFFECT_DUR;
    this.color = color;
    this.renderBehind = MathUtils.randomBoolean();
    this.speedStart = chosenSpeed;
    this.speedTarget = 2000 * Settings.scale;
    this.speed = this.speedStart;
    this.flipper = 270;
    color.g -= MathUtils.random(0.1);
    color.b -= MathUtils.random(0.2);
    color.a = 0;
  }

  update(): void {
    this.stallTimer -= Gdx.graphics.getDeltaTime();
    if (this.stallTimer < 0) {
      const tmp = new Vector2(MathUtils.cosDeg(this.rotation), MathUtils.sinDeg(this.rotation));
      tmp.x *= this.speed * Gdx.graphics.getDeltaTime();
      tmp.y *= this.speed * Gdx.graphics.getDeltaTime();
      this.speed = Interpolation.fade.apply(this.speedStart, this.speedTarget, 1 - this.duration / EFFECT_DUR);
      this.x += tmp.x;
      this.y += tmp.y;
      this.scale *= 1 + Gdx.graphics.getDeltaTime() * 2;
      this.duration -= Gdx.graphics.getDeltaTime();
      if (this.duration < 0) {
        this.isDone = true;
      } else if (this.duration > 1.5) {
        this.color.a = Interpolation.fade.apply(0, 0.7, (EFFECT_DUR - this.duration) * 2);
      } else if (this.duration < 0.5) {
        this.color.a = Interpolation.fade.apply(0, 0.7, this.duration * 2);
      }
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
      this.scale + MathUtils.random(-0.08, 0.08),
      this.scale + MathUtils.random(-0.08, 0.08),
      this.rotation + this.flipper + MathUtils.random(-3, 3),
    );
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
  }
}
