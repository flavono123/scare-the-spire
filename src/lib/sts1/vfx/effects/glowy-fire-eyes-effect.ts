import type { Texture } from "../assets";
import { ImageMaster } from "../assets";
import type { SpriteBatch } from "../batch";
import { AbstractGameEffect } from "../effect";
import { Color, GL_ONE, GL_ONE_MINUS_SRC_ALPHA, GL_SRC_ALPHA, MathUtils } from "../gdx";
import { Gdx, Settings } from "../world";

const W = 128;
const DUR = 1;

/** vfx/GlowyFireEyesEffect. */
export class GlowyFireEyesEffect extends AbstractGameEffect {
  private img: Texture;
  private x: number;
  private y: number;
  private vX: number;
  private vY: number;
  private flippedX: boolean;

  constructor(x: number, y: number) {
    super();
    this.flippedX = MathUtils.randomBoolean();
    this.img = this.getImg();
    this.x = x;
    this.y = y;
    this.vX = MathUtils.random(-10, 10) * Settings.scale;
    this.vY = MathUtils.random(30, 90) * Settings.scale;
    this.duration = DUR;
    this.color = Color.CHARTREUSE.cpy();
    this.color.a = 0;
    this.scale = MathUtils.random(0.45, 0.45) * Settings.scale;
  }

  private getImg(): Texture {
    if (MathUtils.randomBoolean()) {
      return ImageMaster.GHOST_ORB_1;
    }
    return ImageMaster.GHOST_ORB_2;
  }

  update(): void {
    this.x += this.vX * Gdx.graphics.getDeltaTime();
    this.y += this.vY * Gdx.graphics.getDeltaTime();
    this.duration -= Gdx.graphics.getDeltaTime();
    if (this.duration < 0) {
      this.isDone = true;
    }
    this.color.a = this.duration / 2;
  }

  render(sb: SpriteBatch): void {
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE);
    sb.setColor(this.color);
    sb.draw(
      this.img,
      this.x - W / 2,
      this.y - W / 2,
      W / 2,
      W / 2,
      W,
      W,
      this.scale,
      this.scale,
      0,
      0,
      0,
      W,
      W,
      this.flippedX,
      false,
    );
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
  }

  dispose(): void {}
}
