import type { AtlasRegion } from "../assets";
import { ImageMaster } from "../assets";
import type { SpriteBatch } from "../batch";
import { AbstractGameEffect } from "../effect";
import { Color, GL_ONE, GL_ONE_MINUS_SRC_ALPHA, GL_SRC_ALPHA, Interpolation, MathUtils, Vector2 } from "../gdx";
import { Gdx, Settings } from "../world";

const DUR = 0.5;

/** vfx/combat/SmallLaserEffect. */
export class SmallLaserEffect extends AbstractGameEffect {
  private static img: AtlasRegion | null = null;
  private sX: number;
  private sY: number;
  private dX: number;
  private dY: number;
  private dst: number;

  constructor(sX: number, sY: number, dX: number, dY: number) {
    super();
    if (SmallLaserEffect.img === null) SmallLaserEffect.img = ImageMaster.vfxAtlas.findRegion("combat/laserThin");
    this.sX = sX;
    this.sY = sY;
    this.dX = dX;
    this.dY = dY;
    this.dst = Vector2.dst(this.sX, this.sY, this.dX, this.dY) / Settings.scale;
    this.color = Color.CYAN.cpy();
    this.duration = DUR;
    this.startingDuration = DUR;
    this.rotation = MathUtils.atan2(dX - sX, dY - sY);
    this.rotation *= 57.295776;
    this.rotation = -this.rotation + 90;
  }

  update(): void {
    this.duration -= Gdx.graphics.getDeltaTime();
    if (this.duration > this.startingDuration / 2) {
      this.color.a = Interpolation.pow2In.apply(1, 0, (this.duration - 0.25) * 4);
    } else {
      this.color.a = Interpolation.bounceIn.apply(0, 1, this.duration * 4);
    }
    if (this.duration < 0) this.isDone = true;
  }

  render(sb: SpriteBatch): void {
    const img = SmallLaserEffect.img as AtlasRegion;
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE);
    sb.setColor(this.color);
    sb.draw(img, this.sX, this.sY - img.packedHeight / 2 + 10 * Settings.scale, 0, img.packedHeight / 2, this.dst, 50,
      this.scale + MathUtils.random(-0.01, 0.01), this.scale, this.rotation);
    sb.setColor(new Color(0.3, 0.3, 1, this.color.a));
    sb.draw(img, this.sX, this.sY - img.packedHeight / 2, 0, img.packedHeight / 2, this.dst, MathUtils.random(50, 90),
      this.scale + MathUtils.random(-0.02, 0.02), this.scale, this.rotation);
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
  }

  dispose(): void {}
}
