/**
 * The slice of libGDX that STS1's effect classes use, with the same semantics
 * so ported effects read like the Java they came from.
 *
 * Java overloads that differ only by argument type get their own names here:
 * `MathUtils.random(F)F` / `random(FF)F` stay `random`, while the int forms
 * `random(I)I` / `random(II)I` are `randomInt`.
 */

export const GL_ZERO = 0;
export const GL_ONE = 1;
export const GL_ONE_MINUS_SRC_COLOR = 769;
export const GL_SRC_ALPHA = 770;
export const GL_ONE_MINUS_SRC_ALPHA = 771;
export const GL_DST_COLOR = 774;
export const GL_ONE_MINUS_DST_COLOR = 775;

export class Color {
  r: number;
  g: number;
  b: number;
  a: number;

  constructor(r: number | Color = 0, g = 0, b = 0, a = 0) {
    if (r instanceof Color) {
      this.r = r.r;
      this.g = r.g;
      this.b = r.b;
      this.a = r.a;
    } else {
      this.r = r;
      this.g = g;
      this.b = b;
      this.a = a;
    }
  }

  /** `new Color(int rgba8888)`. */
  static fromRgba8888(bits: number): Color {
    const value = bits >>> 0;
    return new Color(
      ((value >>> 24) & 0xff) / 255,
      ((value >>> 16) & 0xff) / 255,
      ((value >>> 8) & 0xff) / 255,
      (value & 0xff) / 255,
    );
  }

  /** `Color.valueOf("rrggbb" | "rrggbbaa")`. */
  static valueOf(hex: string): Color {
    const text = hex.startsWith("#") ? hex.slice(1) : hex;
    const channel = (index: number) => parseInt(text.slice(index, index + 2), 16) / 255;
    return new Color(channel(0), channel(2), channel(4), text.length === 8 ? channel(6) : 1);
  }

  cpy(): Color {
    return new Color(this.r, this.g, this.b, this.a);
  }

  set(r: number | Color, g?: number, b?: number, a?: number): this {
    if (r instanceof Color) {
      this.r = r.r;
      this.g = r.g;
      this.b = r.b;
      this.a = r.a;
    } else {
      this.r = r;
      this.g = g ?? 0;
      this.b = b ?? 0;
      this.a = a ?? 0;
    }
    return this.clamp();
  }

  mul(r: number | Color, g?: number, b?: number, a?: number): this {
    if (r instanceof Color) {
      this.r *= r.r;
      this.g *= r.g;
      this.b *= r.b;
      this.a *= r.a;
    } else if (g === undefined) {
      this.r *= r;
      this.g *= r;
      this.b *= r;
      this.a *= r;
    } else {
      this.r *= r;
      this.g *= g;
      this.b *= b ?? 1;
      this.a *= a ?? 1;
    }
    return this.clamp();
  }

  lerp(target: Color, t: number): this {
    this.r += t * (target.r - this.r);
    this.g += t * (target.g - this.g);
    this.b += t * (target.b - this.b);
    this.a += t * (target.a - this.a);
    return this.clamp();
  }

  clamp(): this {
    this.r = Math.min(1, Math.max(0, this.r));
    this.g = Math.min(1, Math.max(0, this.g));
    this.b = Math.min(1, Math.max(0, this.b));
    this.a = Math.min(1, Math.max(0, this.a));
    return this;
  }

  // libGDX's named colors are shared mutable objects; effects `cpy()` them.
  static readonly WHITE = new Color(1, 1, 1, 1);
  static readonly LIGHT_GRAY = Color.fromRgba8888(0xbfbfbfff);
  static readonly GRAY = Color.fromRgba8888(0x7f7f7fff);
  static readonly DARK_GRAY = Color.fromRgba8888(0x3f3f3fff);
  static readonly BLACK = new Color(0, 0, 0, 1);
  static readonly CLEAR = new Color(0, 0, 0, 0);
  static readonly BLUE = new Color(0, 0, 1, 1);
  static readonly NAVY = new Color(0, 0, 0.5, 1);
  static readonly ROYAL = Color.fromRgba8888(0x4169e1ff);
  static readonly SLATE = Color.fromRgba8888(0x708090ff);
  static readonly SKY = Color.fromRgba8888(0x87ceebff);
  static readonly CYAN = new Color(0, 1, 1, 1);
  static readonly TEAL = new Color(0, 0.5, 0.5, 1);
  static readonly GREEN = Color.fromRgba8888(0x00ff00ff);
  static readonly CHARTREUSE = Color.fromRgba8888(0x7fff00ff);
  static readonly LIME = Color.fromRgba8888(0x32cd32ff);
  static readonly FOREST = Color.fromRgba8888(0x228b22ff);
  static readonly OLIVE = Color.fromRgba8888(0x6b8e23ff);
  static readonly YELLOW = Color.fromRgba8888(0xffff00ff);
  static readonly GOLD = Color.fromRgba8888(0xffd700ff);
  static readonly GOLDENROD = Color.fromRgba8888(0xdaa520ff);
  static readonly ORANGE = Color.fromRgba8888(0xffa500ff);
  static readonly BROWN = Color.fromRgba8888(0x8b4513ff);
  static readonly TAN = Color.fromRgba8888(0xd2b48cff);
  static readonly FIREBRICK = Color.fromRgba8888(0xb22222ff);
  static readonly RED = Color.fromRgba8888(0xff0000ff);
  static readonly SCARLET = Color.fromRgba8888(0xff341cff);
  static readonly CORAL = Color.fromRgba8888(0xff7f50ff);
  static readonly SALMON = Color.fromRgba8888(0xfa8072ff);
  static readonly PINK = Color.fromRgba8888(0xff69b4ff);
  static readonly MAGENTA = new Color(1, 0, 1, 1);
  static readonly PURPLE = Color.fromRgba8888(0xa020f0ff);
  static readonly VIOLET = Color.fromRgba8888(0xee82eeff);
  static readonly MAROON = Color.fromRgba8888(0xb03060ff);
}

// -- MathUtils ------------------------------------------------------------------

const RAD_DEG = 180 / Math.PI;
const DEG_RAD = Math.PI / 180;

export const MathUtils = {
  PI: Math.PI,
  PI2: Math.PI * 2,
  radiansToDegrees: RAD_DEG,
  degreesToRadians: DEG_RAD,
  radDeg: RAD_DEG,
  degRad: DEG_RAD,
  FLOAT_ROUNDING_ERROR: 0.000001,

  /** `random()`, `random(F)F` and `random(FF)F`. */
  random(start?: number, end?: number): number {
    if (start === undefined) return Math.random();
    if (end === undefined) return Math.random() * start;
    return start + Math.random() * (end - start);
  },
  /** `random(I)I` (0..range inclusive) and `random(II)I` (start..end inclusive). */
  randomInt(start: number, end?: number): number {
    if (end === undefined) return Math.floor(Math.random() * (start + 1));
    return start + Math.floor(Math.random() * (end - start + 1));
  },
  randomBoolean(chance?: number): boolean {
    return chance === undefined ? Math.random() < 0.5 : Math.random() < chance;
  },
  randomSign(): number {
    return Math.random() < 0.5 ? -1 : 1;
  },
  sin: Math.sin,
  cos: Math.cos,
  sinDeg(degrees: number): number {
    return Math.sin(degrees * DEG_RAD);
  },
  cosDeg(degrees: number): number {
    return Math.cos(degrees * DEG_RAD);
  },
  atan2: Math.atan2,
  clamp(value: number, min: number, max: number): number {
    return value < min ? min : value > max ? max : value;
  },
  lerp(from: number, to: number, progress: number): number {
    return from + (to - from) * progress;
  },
  floor(value: number): number {
    return Math.floor(value);
  },
  round(value: number): number {
    return Math.round(value);
  },
  ceil(value: number): number {
    return Math.ceil(value);
  },
};

// -- Interpolation --------------------------------------------------------------

export abstract class Interpolation {
  protected abstract curve(a: number): number;

  /** `apply(a)` and `apply(start, end, a)`, as in libGDX. */
  apply(a: number): number;
  apply(start: number, end: number, a: number): number;
  apply(first: number, end?: number, a?: number): number {
    if (end === undefined || a === undefined) return this.curve(first);
    return first + (end - first) * this.curve(a);
  }

  static fade: Interpolation;
  static linear: Interpolation;
  static smooth: Interpolation;
  static smooth2: Interpolation;
  static pow2: Interpolation;
  static pow2In: Interpolation;
  static pow2Out: Interpolation;
  static pow2InInverse: Interpolation;
  static pow2OutInverse: Interpolation;
  static pow3: Interpolation;
  static pow3In: Interpolation;
  static pow3Out: Interpolation;
  static pow4: Interpolation;
  static pow4In: Interpolation;
  static pow4Out: Interpolation;
  static pow5: Interpolation;
  static pow5In: Interpolation;
  static pow5Out: Interpolation;
  static sine: Interpolation;
  static sineIn: Interpolation;
  static sineOut: Interpolation;
  static exp5: Interpolation;
  static exp5In: Interpolation;
  static exp5Out: Interpolation;
  static exp10: Interpolation;
  static exp10In: Interpolation;
  static exp10Out: Interpolation;
  static circle: Interpolation;
  static circleIn: Interpolation;
  static circleOut: Interpolation;
  static elastic: Interpolation;
  static elasticIn: Interpolation;
  static elasticOut: Interpolation;
  static swing: Interpolation;
  static swingIn: Interpolation;
  static swingOut: Interpolation;
  static bounce: Interpolation;
  static bounceIn: Interpolation;
  static bounceOut: Interpolation;
}

class Fn extends Interpolation {
  constructor(private readonly fn: (a: number) => number) {
    super();
  }
  protected curve(a: number): number {
    return this.fn(a);
  }
}

class Pow extends Interpolation {
  constructor(protected readonly power: number) {
    super();
  }
  protected curve(a: number): number {
    if (a <= 0.5) return Math.pow(a * 2, this.power) / 2;
    return Math.pow((a - 1) * 2, this.power) / (this.power % 2 === 0 ? -2 : 2) + 1;
  }
}

class PowIn extends Pow {
  protected curve(a: number): number {
    return Math.pow(a, this.power);
  }
}

class PowOut extends Pow {
  protected curve(a: number): number {
    return Math.pow(a - 1, this.power) * (this.power % 2 === 0 ? -1 : 1) + 1;
  }
}

class Exp extends Interpolation {
  protected readonly min: number;
  protected readonly scale: number;
  constructor(protected readonly value: number, protected readonly power: number) {
    super();
    this.min = Math.pow(value, -power);
    this.scale = 1 / (1 - this.min);
  }
  protected curve(a: number): number {
    if (a <= 0.5) return (Math.pow(this.value, this.power * (a * 2 - 1)) - this.min) * this.scale / 2;
    return (2 - (Math.pow(this.value, -this.power * (a * 2 - 1)) - this.min) * this.scale) / 2;
  }
}

class ExpIn extends Exp {
  protected curve(a: number): number {
    return (Math.pow(this.value, this.power * (a - 1)) - this.min) * this.scale;
  }
}

class ExpOut extends Exp {
  protected curve(a: number): number {
    return 1 - (Math.pow(this.value, -this.power * a) - this.min) * this.scale;
  }
}

class Elastic extends Interpolation {
  protected readonly bounces: number;
  constructor(
    protected readonly value: number,
    protected readonly power: number,
    bounces: number,
    protected readonly scale: number,
  ) {
    super();
    this.bounces = bounces * Math.PI * (bounces % 2 === 0 ? 1 : -1);
  }
  protected curve(a: number): number {
    if (a <= 0.5) {
      a *= 2;
      return Math.pow(this.value, this.power * (a - 1)) * Math.sin(a * this.bounces) * this.scale / 2;
    }
    a = 1 - a;
    a *= 2;
    return 1 - Math.pow(this.value, this.power * (a - 1)) * Math.sin(a * this.bounces) * this.scale / 2;
  }
}

class ElasticIn extends Elastic {
  protected curve(a: number): number {
    if (a >= 0.99) return 1;
    return Math.pow(this.value, this.power * (a - 1)) * Math.sin(a * this.bounces) * this.scale;
  }
}

class ElasticOut extends Elastic {
  protected curve(a: number): number {
    if (a === 0) return 0;
    a = 1 - a;
    return 1 - Math.pow(this.value, this.power * (a - 1)) * Math.sin(a * this.bounces) * this.scale;
  }
}

class Swing extends Interpolation {
  private readonly scale: number;
  constructor(scale: number) {
    super();
    this.scale = scale * 2;
  }
  protected curve(a: number): number {
    if (a <= 0.5) {
      a *= 2;
      return a * a * ((this.scale + 1) * a - this.scale) / 2;
    }
    a -= 1;
    a *= 2;
    return a * a * ((this.scale + 1) * a + this.scale) / 2 + 1;
  }
}

class SwingIn extends Interpolation {
  constructor(private readonly scale: number) {
    super();
  }
  protected curve(a: number): number {
    return a * a * ((this.scale + 1) * a - this.scale);
  }
}

class SwingOut extends Interpolation {
  constructor(private readonly scale: number) {
    super();
  }
  protected curve(a: number): number {
    a -= 1;
    return a * a * ((this.scale + 1) * a + this.scale) + 1;
  }
}

class BounceOut extends Interpolation {
  protected readonly widths: number[];
  protected readonly heights: number[];
  constructor(bounces: number) {
    super();
    const widths = new Array<number>(bounces).fill(0);
    const heights = new Array<number>(bounces).fill(0);
    heights[0] = 1;
    switch (bounces) {
      case 2:
        widths[0] = 0.6; widths[1] = 0.4; heights[1] = 0.33;
        break;
      case 3:
        widths[0] = 0.4; widths[1] = 0.4; widths[2] = 0.2; heights[1] = 0.33; heights[2] = 0.1;
        break;
      case 4:
        widths[0] = 0.34; widths[1] = 0.34; widths[2] = 0.2; widths[3] = 0.15;
        heights[1] = 0.26; heights[2] = 0.11; heights[3] = 0.03;
        break;
      case 5:
        widths[0] = 0.3; widths[1] = 0.3; widths[2] = 0.2; widths[3] = 0.1; widths[4] = 0.1;
        heights[1] = 0.45; heights[2] = 0.3; heights[3] = 0.15; heights[4] = 0.06;
        break;
    }
    widths[0] *= 2;
    this.widths = widths;
    this.heights = heights;
  }
  protected curve(a: number): number {
    if (a === 1) return 1;
    a += this.widths[0] / 2;
    let width = 0;
    let height = 0;
    for (let index = 0; index < this.widths.length; index += 1) {
      width = this.widths[index];
      if (a <= width) {
        height = this.heights[index];
        break;
      }
      a -= width;
    }
    a /= width;
    const z = (4 / width) * height * a;
    return 1 - (z - z * a) * width;
  }
}

class BounceIn extends BounceOut {
  protected curve(a: number): number {
    return 1 - super.curve(1 - a);
  }
}

class Bounce extends BounceOut {
  private out(a: number): number {
    const test = a + this.widths[0] / 2;
    if (test < this.widths[0]) return test / (this.widths[0] / 2) - 1;
    return super.curve(a);
  }
  protected curve(a: number): number {
    if (a <= 0.5) return (1 - this.out(1 - a * 2)) / 2;
    return this.out(a * 2 - 1) / 2 + 0.5;
  }
}

Interpolation.linear = new Fn((a) => a);
Interpolation.smooth = new Fn((a) => a * a * (3 - 2 * a));
Interpolation.smooth2 = new Fn((a) => {
  const s = a * a * (3 - 2 * a);
  return s * s * (3 - 2 * s);
});
Interpolation.fade = new Fn((a) => a * a * a * (a * (a * 6 - 15) + 10));
Interpolation.pow2 = new Pow(2);
Interpolation.pow2In = new PowIn(2);
Interpolation.pow2Out = new PowOut(2);
Interpolation.pow2InInverse = new Fn((a) => (a < MathUtils.FLOAT_ROUNDING_ERROR ? 0 : Math.sqrt(a)));
Interpolation.pow2OutInverse = new Fn((a) => {
  if (a < MathUtils.FLOAT_ROUNDING_ERROR) return 0;
  if (a > 1) return 1;
  return 1 - Math.sqrt(-(a - 1));
});
Interpolation.pow3 = new Pow(3);
Interpolation.pow3In = new PowIn(3);
Interpolation.pow3Out = new PowOut(3);
Interpolation.pow4 = new Pow(4);
Interpolation.pow4In = new PowIn(4);
Interpolation.pow4Out = new PowOut(4);
Interpolation.pow5 = new Pow(5);
Interpolation.pow5In = new PowIn(5);
Interpolation.pow5Out = new PowOut(5);
Interpolation.sine = new Fn((a) => (1 - Math.cos(a * Math.PI)) / 2);
Interpolation.sineIn = new Fn((a) => 1 - Math.cos(a * Math.PI / 2));
Interpolation.sineOut = new Fn((a) => Math.sin(a * Math.PI / 2));
Interpolation.exp5 = new Exp(2, 5);
Interpolation.exp5In = new ExpIn(2, 5);
Interpolation.exp5Out = new ExpOut(2, 5);
Interpolation.exp10 = new Exp(2, 10);
Interpolation.exp10In = new ExpIn(2, 10);
Interpolation.exp10Out = new ExpOut(2, 10);
Interpolation.circle = new Fn((a) => {
  if (a <= 0.5) {
    a *= 2;
    return (1 - Math.sqrt(1 - a * a)) / 2;
  }
  a -= 1;
  a *= 2;
  return (Math.sqrt(1 - a * a) + 1) / 2;
});
Interpolation.circleIn = new Fn((a) => 1 - Math.sqrt(1 - a * a));
Interpolation.circleOut = new Fn((a) => {
  a -= 1;
  return Math.sqrt(1 - a * a);
});
Interpolation.elastic = new Elastic(2, 10, 7, 1);
Interpolation.elasticIn = new ElasticIn(2, 10, 6, 1);
Interpolation.elasticOut = new ElasticOut(2, 10, 7, 1);
Interpolation.swing = new Swing(1.5);
Interpolation.swingIn = new SwingIn(2);
Interpolation.swingOut = new SwingOut(2);
Interpolation.bounce = new Bounce(4);
Interpolation.bounceIn = new BounceIn(4);
Interpolation.bounceOut = new BounceOut(4);

// -- Vector2 / CatmullRomSpline ---------------------------------------------------

export class Vector2 {
  constructor(public x = 0, public y = 0) {}

  static dst(x1: number, y1: number, x2: number, y2: number): number {
    return Math.hypot(x2 - x1, y2 - y1);
  }

  cpy(): Vector2 {
    return new Vector2(this.x, this.y);
  }
  set(x: number | Vector2, y?: number): this {
    if (x instanceof Vector2) {
      this.x = x.x;
      this.y = x.y;
    } else {
      this.x = x;
      this.y = y ?? 0;
    }
    return this;
  }
  add(x: number | Vector2, y?: number): this {
    if (x instanceof Vector2) {
      this.x += x.x;
      this.y += x.y;
    } else {
      this.x += x;
      this.y += y ?? 0;
    }
    return this;
  }
  sub(x: number | Vector2, y?: number): this {
    if (x instanceof Vector2) {
      this.x -= x.x;
      this.y -= x.y;
    } else {
      this.x -= x;
      this.y -= y ?? 0;
    }
    return this;
  }
  scl(x: number, y?: number): this {
    this.x *= x;
    this.y *= y ?? x;
    return this;
  }
  len(): number {
    return Math.hypot(this.x, this.y);
  }
  nor(): this {
    const length = this.len();
    if (length !== 0) {
      this.x /= length;
      this.y /= length;
    }
    return this;
  }
  /** Degrees from the x axis, 0..360. */
  angle(): number {
    let angle = Math.atan2(this.y, this.x) * RAD_DEG;
    if (angle < 0) angle += 360;
    return angle;
  }
  setAngle(degrees: number): this {
    const length = this.len();
    this.x = length * Math.cos(degrees * DEG_RAD);
    this.y = length * Math.sin(degrees * DEG_RAD);
    return this;
  }
  rotate(degrees: number): this {
    const cos = Math.cos(degrees * DEG_RAD);
    const sin = Math.sin(degrees * DEG_RAD);
    const x = this.x * cos - this.y * sin;
    const y = this.x * sin + this.y * cos;
    this.x = x;
    this.y = y;
    return this;
  }
  dst(x: number | Vector2, y?: number): number {
    return x instanceof Vector2 ? Math.hypot(x.x - this.x, x.y - this.y) : Math.hypot(x - this.x, (y ?? 0) - this.y);
  }
  equals(other: unknown): boolean {
    return other instanceof Vector2 && other.x === this.x && other.y === this.y;
  }
}

/** libGDX CatmullRomSpline<Vector2>: `set(points, continuous)` and `valueAt(out, t)`. */
export class CatmullRomSpline {
  controlPoints: Vector2[] = [];
  continuous = false;
  spanCount = 0;

  set(points: Vector2[], continuous: boolean): this {
    this.controlPoints = points;
    this.continuous = continuous;
    this.spanCount = continuous ? points.length : points.length - 3;
    return this;
  }

  valueAt(out: Vector2, t: number): Vector2 {
    const n = this.spanCount;
    let u = t * n;
    const i = t >= 1 ? n - 1 : Math.floor(u);
    u -= i;
    const points = this.controlPoints;
    const count = points.length;
    const index = this.continuous ? i : i + 1;
    const u2 = u * u;
    const u3 = u2 * u;
    const p0 = points[this.continuous ? (index - 1 + count) % count : index - 1];
    const p1 = points[index % count];
    const p2 = points[(index + 1) % count];
    const p3 = points[this.continuous ? (index + 2) % count : index + 2];
    out.set(p1).scl(1.5 * u3 - 2.5 * u2 + 1);
    out.add(p0.x * (-0.5 * u3 + u2 - 0.5 * u), p0.y * (-0.5 * u3 + u2 - 0.5 * u));
    out.add(p2.x * (-1.5 * u3 + 2 * u2 + 0.5 * u), p2.y * (-1.5 * u3 + 2 * u2 + 0.5 * u));
    out.add(p3.x * (0.5 * u3 - 0.5 * u2), p3.y * (0.5 * u3 - 0.5 * u2));
    return out;
  }
}
