import { MathUtils } from "../gdx";
import { Gdx, Settings } from "../world";

const DEFAULT_DIST = 5 * Settings.scale;
const DEFAULT_SPEED = 4;

/**
 * vfx/BobEffect. Not an AbstractGameEffect: monsters and orbs own one and
 * add its `y` to their draw position to float up and down.
 */
export class BobEffect {
  y: number;
  speed: number;
  dist: number;
  private timer: number;

  /** `BobEffect()`: default distance and speed. */
  constructor();
  /** `BobEffect(speed)`: default distance. */
  constructor(speed: number);
  /** `BobEffect(dist, speed)`. */
  constructor(dist: number, speed: number);
  constructor(first?: number, second?: number) {
    let dist: number;
    let speed: number;
    if (first === undefined) {
      dist = DEFAULT_DIST;
      speed = DEFAULT_SPEED;
    } else if (second === undefined) {
      dist = DEFAULT_DIST;
      speed = first;
    } else {
      dist = first;
      speed = second;
    }
    this.y = 0;
    this.timer = MathUtils.random(0, 359);
    this.speed = speed;
    this.dist = dist;
  }

  update(): void {
    this.y = MathUtils.sin(this.timer) * this.dist;
    this.timer += Gdx.graphics.getDeltaTime() * this.speed;
  }
}
