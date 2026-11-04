import type { AtlasRegion } from "../assets";
import { ImageMaster } from "../assets";
import type { SpriteBatch } from "../batch";
import { AbstractGameEffect } from "../effect";
import { Color, GL_ONE, GL_ONE_MINUS_SRC_ALPHA, GL_SRC_ALPHA, Interpolation, MathUtils } from "../gdx";
import { AbstractDungeon, Gdx, Settings } from "../world";

const FADE_IN_TIME = 0.05;
const FADE_OUT_TIME = 0.4;

/** vfx/combat/CleaveEffect. */
export class CleaveEffect extends AbstractGameEffect {
  private x = 0;
  private y = 0;
  private vX = 0;
  private fadeInTimer = FADE_IN_TIME;
  private fadeOutTimer = FADE_OUT_TIME;
  private stallTimer = 0;
  private img: AtlasRegion;

  /** `CleaveEffect(usedByMonster)`: centered at 30% of the screen width (the flag's value is not read). */
  constructor(usedByMonster: boolean);
  /** `CleaveEffect()`: centered at 70% of the screen width. */
  constructor();
  constructor(usedByMonster?: boolean) {
    super();
    this.img = ImageMaster.vfxAtlas.findRegion("combat/cleave");
    this.color = new Color(1, 1, 1, 0);
    if (usedByMonster !== undefined) {
      this.x = Settings.WIDTH * 0.3 - this.img.packedWidth / 2;
    } else {
      this.x = Settings.WIDTH * 0.7 - this.img.packedWidth / 2;
    }
    this.y = AbstractDungeon.floorY + 100 * Settings.scale - this.img.packedHeight / 2;
    this.vX = 100 * Settings.scale;
    this.stallTimer = MathUtils.random(0, 0.2);
    this.scale = 1.2 * Settings.scale;
    this.rotation = MathUtils.random(-5, 1);
  }

  update(): void {
    if (this.stallTimer > 0) {
      this.stallTimer -= Gdx.graphics.getDeltaTime();
      return;
    }
    this.x += this.vX * Gdx.graphics.getDeltaTime();
    this.rotation += MathUtils.random(-0.5, 0.5);
    this.scale += 0.005 * Settings.scale;
    if (this.fadeInTimer !== 0) {
      this.fadeInTimer -= Gdx.graphics.getDeltaTime();
      if (this.fadeInTimer < 0) {
        this.fadeInTimer = 0;
      }
      this.color.a = Interpolation.fade.apply(1, 0, this.fadeInTimer / FADE_IN_TIME);
    } else if (this.fadeOutTimer !== 0) {
      this.fadeOutTimer -= Gdx.graphics.getDeltaTime();
      if (this.fadeOutTimer < 0) {
        this.fadeOutTimer = 0;
      }
      this.color.a = Interpolation.pow2.apply(0, 1, this.fadeOutTimer / FADE_OUT_TIME);
    } else {
      this.isDone = true;
    }
  }

  render(sb: SpriteBatch): void {
    sb.setColor(this.color);
    sb.draw(
      this.img,
      this.x,
      this.y,
      this.img.packedWidth / 2,
      this.img.packedHeight / 2,
      this.img.packedWidth,
      this.img.packedHeight,
      this.scale,
      this.scale,
      this.rotation,
    );
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE);
    sb.draw(
      this.img,
      this.x,
      this.y,
      this.img.packedWidth / 2,
      this.img.packedHeight / 2,
      this.img.packedWidth,
      this.img.packedHeight,
      this.scale,
      this.scale,
      this.rotation,
    );
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
  }

  dispose(): void {}
}
