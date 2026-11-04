import type { SpriteBatch } from "../batch";
import { ImageMaster } from "../assets";
import { AbstractGameEffect } from "../effect";
import { Color, GL_ONE, GL_ONE_MINUS_SRC_ALPHA, GL_SRC_ALPHA, Interpolation } from "../gdx";
import { Gdx, Settings } from "../world";

const DUR = 2;

/** vfx/BorderLongFlashEffect. */
export class BorderLongFlashEffect extends AbstractGameEffect {
  private startAlpha: number;
  private additive = true;

  /** `BorderLongFlashEffect(Color)`: additive. */
  constructor(color: Color);
  /** `BorderLongFlashEffect(Color, boolean)`. */
  constructor(color: Color, additive: boolean);
  constructor(color: Color, additive = true) {
    super();
    this.duration = DUR;
    this.startAlpha = color.a;
    this.color = color.cpy();
    this.color.a = 0;
    this.additive = additive;
  }

  update(): void {
    if (DUR - this.duration < 0.2) {
      this.color.a = Interpolation.fade.apply(0, this.startAlpha, (DUR - this.duration) * 10);
    } else {
      this.color.a = Interpolation.pow2Out.apply(0, this.startAlpha, this.duration / DUR);
    }
    this.duration -= Gdx.graphics.getDeltaTime();
    if (this.duration < 0) this.isDone = true;
  }

  render(sb: SpriteBatch): void {
    if (this.additive) sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE);
    sb.setColor(this.color);
    sb.draw(ImageMaster.BORDER_GLOW_2, 0, 0, Settings.WIDTH, Settings.HEIGHT);
    if (this.additive) sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
  }
}
