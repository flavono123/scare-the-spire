import type { AtlasRegion } from "../assets";
import { ImageMaster } from "../assets";
import type { SpriteBatch } from "../batch";
import { AbstractGameEffect } from "../effect";
import type { Color } from "../gdx";
import { GL_ONE, GL_ONE_MINUS_SRC_ALPHA, GL_SRC_ALPHA, Interpolation, MathUtils, Vector2 } from "../gdx";
import { Gdx, Settings } from "../world";

const EFFECT_DUR = 2;

/** vfx/combat/WobblyLineEffect. Keeps (and tints) the color it is given. */
export class WobblyLineEffect extends AbstractGameEffect {
  private x: number;
  private y: number;
  private speed: number;
  private speedStart: number;
  private speedTarget: number;
  private flipper: number;
  private img: AtlasRegion;

  constructor(x: number, y: number, color: Color) {
    super();
    this.img = ImageMaster.WOBBLY_LINE;
    this.rotation = MathUtils.random(360);
    this.scale = MathUtils.random(0.2, 0.4);
    this.x = x - this.img.packedWidth / 2;
    this.y = y - this.img.packedHeight / 2;
    this.duration = EFFECT_DUR;
    this.color = color;
    this.renderBehind = MathUtils.randomBoolean();
    this.speedStart = MathUtils.random(300, 1000) * Settings.scale;
    this.speedTarget = 900 * Settings.scale;
    this.speed = this.speedStart;
    if (MathUtils.randomBoolean()) {
      this.flipper = 90;
    } else {
      this.flipper = 270;
    }
    color.g -= MathUtils.random(0.1);
    color.b -= MathUtils.random(0.2);
    color.a = 0;
  }

  update(): void {
    const tmp = new Vector2(MathUtils.cosDeg(this.rotation), MathUtils.sinDeg(this.rotation));
    tmp.x *= this.speed * Gdx.graphics.getDeltaTime();
    tmp.y *= this.speed * Gdx.graphics.getDeltaTime();
    this.speed = Interpolation.fade.apply(this.speedStart, this.speedTarget, 1 - this.duration / 2);
    this.x += tmp.x;
    this.y += tmp.y;
    this.scale += Gdx.graphics.getDeltaTime();
    this.duration -= Gdx.graphics.getDeltaTime();
    if (this.duration < 0) {
      this.isDone = true;
    } else if (this.duration > 1.5) {
      this.color.a = Interpolation.fade.apply(0, 0.7, (2 - this.duration) * 2);
    } else if (this.duration < 0.5) {
      this.color.a = Interpolation.fade.apply(0, 0.7, this.duration * 2);
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
      this.scale + MathUtils.random(-0.08, 0.08) * Settings.scale,
      this.scale + MathUtils.random(-0.08, 0.08) * Settings.scale,
      this.rotation + this.flipper + MathUtils.random(-5, 5),
    );
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
  }

  dispose(): void {}
}
