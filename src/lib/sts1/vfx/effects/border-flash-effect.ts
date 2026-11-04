import type { SpriteBatch } from "../batch";
import type { AtlasRegion } from "../assets";
import { ImageMaster } from "../assets";
import { AbstractGameEffect } from "../effect";
import { Color, GL_ONE, GL_ONE_MINUS_SRC_ALPHA, GL_SRC_ALPHA, Interpolation } from "../gdx";
import { Gdx, Settings } from "../world";

const DUR = 1;

/** vfx/BorderFlashEffect. */
export class BorderFlashEffect extends AbstractGameEffect {
  private img: AtlasRegion;
  private additive: boolean;

  /** `BorderFlashEffect(Color)`: additive. */
  constructor(color: Color);
  /** `BorderFlashEffect(Color, boolean)`. */
  constructor(color: Color, additive: boolean);
  constructor(color: Color, additive = true) {
    super();
    this.img = ImageMaster.BORDER_GLOW_2;
    this.duration = DUR;
    this.color = color.cpy();
    this.color.a = 0;
    this.additive = additive;
  }

  update(): void {
    if (DUR - this.duration < 0.1) {
      this.color.a = Interpolation.fade.apply(0, 1, (DUR - this.duration) * 10);
    } else {
      this.color.a = Interpolation.pow2Out.apply(0, 1, this.duration);
    }
    this.duration -= Gdx.graphics.getDeltaTime();
    if (this.duration < 0) this.isDone = true;
  }

  render(sb: SpriteBatch): void {
    if (this.additive) {
      sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE);
      sb.setColor(this.color);
      sb.draw(this.img, 0, 0, Settings.WIDTH, Settings.HEIGHT);
      sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
    } else {
      sb.setColor(this.color);
      sb.draw(this.img, 0, 0, Settings.WIDTH, Settings.HEIGHT);
    }
  }
}
