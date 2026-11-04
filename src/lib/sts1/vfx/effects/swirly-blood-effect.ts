import type { SpriteBatch } from "../batch";
import type { AtlasRegion } from "../assets";
import { ImageMaster } from "../assets";
import { AbstractGameEffect } from "../effect";
import {
  CatmullRomSpline,
  Color,
  GL_ONE,
  GL_ONE_MINUS_SRC_ALPHA,
  GL_SRC_ALPHA,
  Interpolation,
  MathUtils,
  Vector2,
} from "../gdx";
import { Gdx, Settings } from "../world";

const TRAIL_ACCURACY = 60;
const VELOCITY_RAMP_RATE = 3000 * Settings.scale;

/** vfx/combat/SwirlyBloodEffect. */
export class SwirlyBloodEffect extends AbstractGameEffect {
  private img: AtlasRegion;
  private crs = new CatmullRomSpline();
  private controlPoints: Vector2[] = [];
  private points: (Vector2 | null)[] = new Array<Vector2 | null>(TRAIL_ACCURACY).fill(null);
  private pos: Vector2;
  private target: Vector2;
  private currentSpeed = 0;
  private rotateClockwise = true;
  private stopRotating = false;
  private rotationRate: number;

  constructor(x: number, y: number) {
    super();
    this.img = ImageMaster.GLOW_SPARK_2;
    this.pos = new Vector2(x, y);
    this.target = new Vector2(x + 100, y + 100);
    this.crs.controlPoints = new Array<Vector2>(1);
    this.rotateClockwise = MathUtils.randomBoolean();
    this.rotation = MathUtils.randomInt(0, 359);
    this.controlPoints.length = 0;
    this.rotationRate = MathUtils.random(800, 1000) * Settings.scale;
    this.currentSpeed = this.rotationRate / 2;
    this.color = new Color(MathUtils.random(0.3, 1), 0.3, MathUtils.random(0.6, 1), 0.25);
    this.duration = MathUtils.random(1, 1.5);
    this.renderBehind = MathUtils.randomBoolean();
    this.scale = 1e-5;
  }

  update(): void {
    this.updateMovement();
  }

  private updateMovement(): void {
    const tmp = new Vector2(this.pos.x - this.target.x, this.pos.y - this.target.y);
    tmp.nor();
    if (!this.stopRotating) {
      if (this.rotateClockwise) {
        this.rotation += Gdx.graphics.getDeltaTime() * this.rotationRate;
      } else {
        this.rotation -= Gdx.graphics.getDeltaTime() * this.rotationRate;
        if (this.rotation < 0) this.rotation += 360;
      }
      this.rotation %= 360;
    }
    tmp.setAngle(this.rotation);
    tmp.x *= Gdx.graphics.getDeltaTime() * this.currentSpeed;
    tmp.y *= Gdx.graphics.getDeltaTime() * this.currentSpeed;
    this.pos.sub(tmp);
    this.currentSpeed += Gdx.graphics.getDeltaTime() * VELOCITY_RAMP_RATE * 1.5;

    if (this.controlPoints.length !== 0) {
      if (!this.controlPoints[0].equals(this.pos)) this.controlPoints.push(this.pos.cpy());
    } else {
      this.controlPoints.push(this.pos.cpy());
    }
    if (this.controlPoints.length > 3) {
      this.crs.set(this.controlPoints.slice(), false);
      for (let i = 0; i < TRAIL_ACCURACY; i += 1) {
        const point = new Vector2();
        this.points[i] = point;
        this.crs.valueAt(point, i / (TRAIL_ACCURACY - 1));
      }
    }
    if (this.controlPoints.length > 5) this.controlPoints.splice(0, 1);

    this.duration -= Gdx.graphics.getDeltaTime();
    this.scale = Interpolation.pow2In.apply(2, 0.01, this.duration) * Settings.scale;
    if (this.duration < 0.5) this.color.a = this.duration / 2;
    if (this.duration < 0) this.isDone = true;
  }

  render(sb: SpriteBatch): void {
    if (this.isDone) return;
    sb.setColor(new Color(0, 0, 0, this.color.a / 2));
    let scaleCpy = this.scale * 2;
    for (let i = this.points.length - 1; i > 0; i -= 1) {
      const point = this.points[i];
      if (point !== null) {
        sb.draw(
          this.img,
          point.x - Math.trunc(this.img.packedWidth / 2),
          point.y - Math.trunc(this.img.packedHeight / 2),
          this.img.packedWidth / 2,
          this.img.packedHeight / 2,
          this.img.packedWidth,
          this.img.packedHeight,
          scaleCpy,
          scaleCpy,
          this.rotation,
        );
        scaleCpy *= 0.975;
      }
    }
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE);
    sb.setColor(this.color);
    scaleCpy = this.scale * 1.5;
    for (let i = this.points.length - 1; i > 0; i -= 1) {
      const point = this.points[i];
      if (point !== null) {
        sb.draw(
          this.img,
          point.x - Math.trunc(this.img.packedWidth / 2),
          point.y - Math.trunc(this.img.packedHeight / 2),
          this.img.packedWidth / 2,
          this.img.packedHeight / 2,
          this.img.packedWidth,
          this.img.packedHeight,
          scaleCpy,
          scaleCpy,
          this.rotation,
        );
        scaleCpy *= 0.975;
      }
    }
    sb.setBlendFunction(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
  }
}
