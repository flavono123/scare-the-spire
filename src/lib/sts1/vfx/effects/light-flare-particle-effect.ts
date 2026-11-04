import type { AtlasRegion } from "../assets";
import { ImageMaster } from "../assets";
import type { SpriteBatch } from "../batch";
import { AbstractGameEffect } from "../effect";
import { Color, GL_ONE, GL_ONE_MINUS_SRC_ALPHA, GL_SRC_ALPHA, Interpolation, MathUtils, Vector2 } from "../gdx";
import { Gdx, Settings } from "../world";

/** vfx/combat/LightFlareParticleEffect. */
export class LightFlareParticleEffect extends AbstractGameEffect {
  private pos = new Vector2();
  private speed: number;
  private speedStart: number;
  private speedTarget: number;
  private waveIntensity: number;
  private waveSpeed: number;
  private img: AtlasRegion;

  constructor(x: number, y: number, color: Color) {
    super();
    this.img = ImageMaster.STRIKE_BLUR;
    this.duration = MathUtils.random(0.5, 1.1);
    this.startingDuration = this.duration;
    this.pos.x = x - this.img.packedWidth / 2;
    this.pos.y = y - this.img.packedHeight / 2;
    this.speed = MathUtils.random(200, 300) * Settings.scale;
    this.speedStart = this.speed;
    this.speedTarget = MathUtils.random(20, 30) * Settings.scale;
    this.color = color.cpy();
    this.color.a = 0;
    this.renderBehind = true;
    this.rotation = MathUtils.random(360);
    this.waveIntensity = MathUtils.random(5, 10);
    this.waveSpeed = MathUtils.random(-20, 20);
    this.speedTarget = MathUtils.random(0.1, 0.5);
    this.scale = MathUtils.random(0.2, 1) * Settings.scale;
  }

  update(): void {
    const tmp = new Vector2(MathUtils.cosDeg(this.rotation), MathUtils.sinDeg(this.rotation));
    tmp.x *= this.speed * Gdx.graphics.getDeltaTime();
    tmp.y *= this.speed * Gdx.graphics.getDeltaTime();
    this.speed = Interpolation.pow2OutInverse.apply(this.speedStart, this.speedTarget,
      1 - this.duration / this.startingDuration);
    this.pos.x += tmp.x;
    this.pos.y += tmp.y;
    this.rotation += MathUtils.cos(this.duration * this.waveSpeed) * this.waveIntensity;
    if (this.duration < 0.5) {
      this.color.a = Interpolation.fade.apply(0, 1, this.duration * 2);
    } else {
      this.color.a = 1;
    }
    super.update();
  }

  render(sb: SpriteBatch): void {
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE);
    sb.setColor(new Color(this.color.r, this.color.g, this.color.b, this.color.a / 4));
    sb.draw(this.img, this.pos.x, this.pos.y, this.img.packedWidth / 2, this.img.packedHeight / 2, this.img.packedWidth,
      this.img.packedHeight, this.scale * 4, this.scale * 4, this.rotation);
    sb.setColor(this.color);
    sb.draw(this.img, this.pos.x, this.pos.y, this.img.packedWidth / 2, this.img.packedHeight / 2, this.img.packedWidth,
      this.img.packedHeight, this.scale, this.scale, this.rotation);
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
  }

  dispose(): void {}
}
