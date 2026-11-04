import type { AtlasRegion } from "../assets";
import { ImageMaster } from "../assets";
import type { SpriteBatch } from "../batch";
import { AbstractGameEffect } from "../effect";
import { Color, GL_ONE, GL_ONE_MINUS_SRC_ALPHA, GL_SRC_ALPHA, Interpolation, MathUtils, Vector2 } from "../gdx";
import { Gdx, Settings } from "../world";

/** vfx/combat/DamageImpactCurvyEffect. */
export class DamageImpactCurvyEffect extends AbstractGameEffect {
  private pos = new Vector2();
  private speed = 0;
  private speedStart = 0;
  private speedTarget = 0;
  private waveIntensity = 0;
  private waveSpeed = 0;
  private img: AtlasRegion;
  private positions: Vector2[] = [];

  /** `DamageImpactCurvyEffect(x, y, color, renderBehind)`: `color` is kept, not copied. */
  constructor(x: number, y: number, color: Color, renderBehind: boolean);
  /** `DamageImpactCurvyEffect(x, y)`: the shared `Color.GOLDENROD`, rendered behind. */
  constructor(x: number, y: number);
  constructor(x: number, y: number, color?: Color, renderBehind?: boolean) {
    super();
    this.img = ImageMaster.STRIKE_LINE_2;
    this.duration = MathUtils.random(0.8, 1.1);
    this.startingDuration = this.duration;
    this.pos.x = x - this.img.packedWidth / 2;
    this.pos.y = y - this.img.packedHeight / 2;
    this.speed = MathUtils.random(400, 900) * Settings.scale;
    this.speedStart = this.speed;
    this.speedTarget = MathUtils.random(200, 300) * Settings.scale;
    this.color = color ?? Color.GOLDENROD;
    this.renderBehind = renderBehind ?? true;
    this.rotation = MathUtils.random(360);
    this.waveIntensity = MathUtils.random(5, 30);
    this.waveSpeed = MathUtils.random(-20, 20);
    this.speedTarget = MathUtils.random(0.1, 0.5);
  }

  update(): void {
    // The game stores the same `pos` vector every frame, not a copy.
    this.positions.push(this.pos);
    const tmp = new Vector2(MathUtils.cosDeg(this.rotation), MathUtils.sinDeg(this.rotation));
    tmp.x *= this.speed * Gdx.graphics.getDeltaTime();
    tmp.y *= this.speed * Gdx.graphics.getDeltaTime();
    this.speed = Interpolation.pow2OutInverse.apply(
      this.speedStart,
      this.speedTarget,
      1 - this.duration / this.startingDuration,
    );
    this.pos.x += tmp.x;
    this.pos.y += tmp.y;
    this.rotation +=
      MathUtils.cos(this.duration * this.waveSpeed) * this.waveIntensity * Gdx.graphics.getDeltaTime() * 60;
    this.scale = ((Settings.scale * this.duration) / this.startingDuration) * 0.75;
    super.update();
  }

  render(sb: SpriteBatch): void {
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE);
    const tmp = this.color.cpy();
    tmp.a = 0.25;
    for (let i = this.positions.length - 1; i > 0; i--) {
      sb.setColor(tmp);
      tmp.a *= 0.95;
      if (tmp.a > 0.05) {
        sb.draw(
          this.img,
          this.positions[i].x,
          this.positions[i].y,
          this.img.packedWidth / 2,
          this.img.packedHeight / 2,
          this.img.packedWidth,
          this.img.packedHeight,
          this.scale * 2,
          this.scale * 2,
          this.rotation,
        );
      }
    }
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
  }

  dispose(): void {}
}
