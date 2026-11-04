import { ImageMaster } from "../assets";
import type { SpriteBatch } from "../batch";
import { AbstractGameEffect } from "../effect";
import type { Color } from "../gdx";
import { GL_ONE, GL_ONE_MINUS_SRC_ALPHA, GL_SRC_ALPHA, Interpolation, MathUtils } from "../gdx";
import { Gdx, Settings } from "../world";

/** vfx/combat/AnimatedSlashEffect. */
export class AnimatedSlashEffect extends AbstractGameEffect {
  private x = 0;
  private y = 0;
  private sX = 0;
  private sY = 0;
  private tX = 0;
  private tY = 0;
  private scaleX = 0;
  private scaleY = 0;
  private targetScale = 0;
  private color2: Color;

  /** `AnimatedSlashEffect(x, y, dX, dY, angle, color1, color2)`: target scale 2. */
  constructor(x: number, y: number, dX: number, dY: number, angle: number, color1: Color, color2: Color);
  /** `AnimatedSlashEffect(x, y, dX, dY, angle, targetScale, color1, color2)`. */
  constructor(
    x: number,
    y: number,
    dX: number,
    dY: number,
    angle: number,
    targetScale: number,
    color1: Color,
    color2: Color,
  );
  constructor(
    x: number,
    y: number,
    dX: number,
    dY: number,
    angle: number,
    ...rest: [color1: Color, color2: Color] | [targetScale: number, color1: Color, color2: Color]
  ) {
    super();
    const [targetScale, color1, color2] = rest.length === 2 ? [2, rest[0], rest[1]] : rest;
    this.x = x - 64 - (dX / 2) * Settings.scale;
    this.y = y - 64 - (dY / 2) * Settings.scale;
    this.sX = this.x;
    this.sY = this.y;
    this.tX = this.x + (dX / 2) * Settings.scale;
    this.tY = this.y + (dY / 2) * Settings.scale;
    this.color = color1.cpy();
    this.color2 = color2.cpy();
    this.color.a = 0;
    this.startingDuration = 0.4;
    this.duration = this.startingDuration;
    this.targetScale = targetScale;
    this.scaleX = 0.01;
    this.scaleY = 0.01;
    this.rotation = -135;
    this.rotation = angle;
  }

  update(): void {
    if (this.duration > this.startingDuration / 2) {
      this.color.a = Interpolation.exp10In.apply(
        0.8,
        0,
        (this.duration - this.startingDuration / 2) / (this.startingDuration / 2),
      );
      this.scaleX = Interpolation.exp10In.apply(
        this.targetScale,
        0.1,
        (this.duration - this.startingDuration / 2) / (this.startingDuration / 2),
      );
      this.scaleY = this.scaleX;
      this.x = Interpolation.fade.apply(
        this.tX,
        this.sX,
        (this.duration - this.startingDuration / 2) / (this.startingDuration / 2),
      );
      this.y = Interpolation.fade.apply(
        this.tY,
        this.sY,
        (this.duration - this.startingDuration / 2) / (this.startingDuration / 2),
      );
    } else {
      // The game eases only scaleX here; scaleY keeps its last value.
      this.scaleX = Interpolation.pow2In.apply(0.5, this.targetScale, this.duration / (this.startingDuration / 2));
      this.color.a = Interpolation.pow5In.apply(0, 0.8, this.duration / (this.startingDuration / 2));
    }
    this.duration -= Gdx.graphics.getDeltaTime();
    if (this.duration < 0) {
      this.isDone = true;
    }
  }

  render(sb: SpriteBatch): void {
    sb.setColor(this.color2);
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE);
    sb.draw(
      ImageMaster.ANIMATED_SLASH_VFX,
      this.x,
      this.y,
      64,
      64,
      128,
      128,
      this.scaleX * 0.4 * MathUtils.random(0.95, 1.05) * Settings.scale,
      this.scaleY * 0.7 * MathUtils.random(0.95, 1.05) * Settings.scale,
      this.rotation,
      0,
      0,
      128,
      128,
      false,
      false,
    );
    sb.setColor(this.color);
    sb.draw(
      ImageMaster.ANIMATED_SLASH_VFX,
      this.x,
      this.y,
      64,
      64,
      128,
      128,
      this.scaleX * 0.7 * MathUtils.random(0.95, 1.05) * Settings.scale,
      this.scaleY * MathUtils.random(0.95, 1.05) * Settings.scale,
      this.rotation,
      0,
      0,
      128,
      128,
      false,
      false,
    );
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
  }

  dispose(): void {}
}
