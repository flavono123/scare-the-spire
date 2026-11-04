import type { SpriteBatch } from "../batch";
import { ImageMaster } from "../assets";
import { AbstractGameEffect } from "../effect";
import { Color, Interpolation } from "../gdx";
import { Gdx, Settings } from "../world";

const DEFAULT_DUR = 2;

/** vfx/combat/RoomTintEffect. Keeps (and fades) the caller's `Color` itself, as the game does. */
export class RoomTintEffect extends AbstractGameEffect {
  private tintTransparency: number;

  /** `RoomTintEffect(Color, float)`: 2 seconds, behind the room. */
  constructor(color: Color, transparency: number);
  /** `RoomTintEffect(Color, float, float, boolean)`. */
  constructor(color: Color, transparency: number, setDuration: number, renderBehind: boolean);
  constructor(color: Color, transparency: number, setDuration = DEFAULT_DUR, renderBehind = true) {
    super();
    this.renderBehind = renderBehind;
    this.startingDuration = setDuration;
    this.duration = setDuration;
    this.color = color;
    this.color.a = 0;
    this.tintTransparency = transparency;
  }

  update(): void {
    if (this.duration > this.startingDuration * 0.5) {
      this.color.a = Interpolation.fade.apply(
        this.tintTransparency,
        0,
        (this.duration - this.startingDuration * 0.5) / this.startingDuration,
      );
    } else if (this.duration < this.startingDuration * 0.5) {
      this.color.a = Interpolation.fade.apply(0, this.tintTransparency, this.duration / this.startingDuration / 0.5);
    }
    this.duration -= Gdx.graphics.getDeltaTime();
    if (this.duration < 0) this.isDone = true;
  }

  render(sb: SpriteBatch): void {
    sb.setColor(this.color);
    sb.draw(ImageMaster.WHITE_SQUARE_IMG, 0, 0, Settings.WIDTH, Settings.HEIGHT);
  }
}
