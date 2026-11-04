import type { AtlasRegion } from "../assets";
import { ImageMaster } from "../assets";
import type { SpriteBatch } from "../batch";
import { AbstractGameEffect } from "../effect";
import { Color, GL_ONE, GL_ONE_MINUS_SRC_ALPHA, GL_SRC_ALPHA, Interpolation, MathUtils } from "../gdx";
import { CardCrawlGame, Gdx, Settings } from "../world";

const DUR = 1;

/** vfx/combat/BiteEffect. */
export class BiteEffect extends AbstractGameEffect {
  private static top: AtlasRegion | null = null;
  private static bot: AtlasRegion | null = null;
  private x = 0;
  private y = 0;
  private sY = 0;
  private dY = 0;
  private y2 = 0;
  private sY2 = 0;
  private dY2 = 0;
  private playedSfx = false;

  /** `BiteEffect(x, y, c)`. */
  constructor(x: number, y: number, c: Color);
  /** `BiteEffect(x, y)`: `new Color(0.7, 0.9, 1, 0)`. */
  constructor(x: number, y: number);
  constructor(x: number, y: number, c?: Color) {
    super();
    if (BiteEffect.top == null) {
      BiteEffect.top = ImageMaster.vfxAtlas.findRegion("combat/biteTop");
      BiteEffect.bot = ImageMaster.vfxAtlas.findRegion("combat/biteBot");
    }
    this.x = x - BiteEffect.top.packedWidth / 2;
    this.sY = y - BiteEffect.top.packedHeight / 2 + 150 * Settings.scale;
    this.dY = y - 0 * Settings.scale;
    this.y = this.sY;
    this.sY2 = y - Math.trunc(BiteEffect.top.packedHeight / 2) - 100 * Settings.scale;
    this.dY2 = y - 90 * Settings.scale;
    this.y2 = this.sY2;
    this.duration = DUR;
    this.startingDuration = DUR;
    this.color = c ?? new Color(0.7, 0.9, 1, 0);
    this.scale = 1 * Settings.scale;
  }

  update(): void {
    this.duration -= Gdx.graphics.getDeltaTime();
    if (this.duration < this.startingDuration - 0.3 && !this.playedSfx) {
      this.playedSfx = true;
      CardCrawlGame.sound.play("EVENT_VAMP_BITE", 0.05);
    }
    if (this.duration > this.startingDuration / 2) {
      this.color.a = Interpolation.fade.apply(1, 0, (this.duration - 0.5) * 2);
      this.y = Interpolation.bounceIn.apply(this.dY, this.sY, (this.duration - 0.5) * 2);
      this.y2 = Interpolation.bounceIn.apply(this.dY2, this.sY2, (this.duration - 0.5) * 2);
    } else {
      this.color.a = Interpolation.fade.apply(0, 1, this.duration * 2);
      this.y = Interpolation.fade.apply(this.sY, this.dY, this.duration * 2);
      this.y2 = Interpolation.fade.apply(this.sY2, this.dY2, this.duration * 2);
    }
    if (this.duration < 0) {
      this.isDone = true;
    }
  }

  render(sb: SpriteBatch): void {
    const top = BiteEffect.top!;
    const bot = BiteEffect.bot!;
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE);
    sb.setColor(this.color);
    sb.draw(
      top,
      this.x,
      this.y,
      top.packedWidth / 2,
      top.packedHeight / 2,
      top.packedWidth,
      top.packedHeight,
      this.scale + MathUtils.random(-0.05, 0.05),
      this.scale + MathUtils.random(-0.05, 0.05),
      0,
    );
    // The game sizes the bottom jaw by the top jaw's region.
    sb.draw(
      bot,
      this.x,
      this.y2,
      top.packedWidth / 2,
      top.packedHeight / 2,
      top.packedWidth,
      top.packedHeight,
      this.scale + MathUtils.random(-0.05, 0.05),
      this.scale + MathUtils.random(-0.05, 0.05),
      0,
    );
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
  }

  dispose(): void {}
}
