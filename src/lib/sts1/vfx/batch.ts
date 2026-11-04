/**
 * A WebGL SpriteBatch with libGDX's draw overloads and blending, so ported
 * effects draw exactly what the game's batch would.
 *
 * Coordinates are the game's screen units, y up. The canvas is a transparent,
 * premultiplied overlay, so every pixel's alpha must cover its color: GPU
 * compositors (headed Chrome on macOS) drop pixels whose color exceeds alpha,
 * which is what additive light with untouched alpha leaves. Normal blending
 * writes coverage as usual; additive light writes premultiplied color with its
 * brightest channel as coverage, so it lightens the page like a screen blend.
 */
import type { SheetImage } from "./assets";
import { Texture, TextureRegion } from "./assets";
import {
  Color,
  GL_ONE,
  GL_ONE_MINUS_SRC_ALPHA,
  GL_SRC_ALPHA,
  GL_ZERO,
} from "./gdx";

const MAX_SPRITES = 2000;
const FLOATS_PER_VERTEX = 8;
const FLOATS_PER_SPRITE = FLOATS_PER_VERTEX * 4;

const VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
attribute vec4 a_color;
uniform vec4 u_view;
varying vec2 v_texCoord;
varying vec4 v_color;
void main() {
  v_texCoord = a_texCoord;
  v_color = a_color;
  gl_Position = vec4((a_position.x - u_view.x) * u_view.z - 1.0, (a_position.y - u_view.y) * u_view.w - 1.0, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `
precision mediump float;
varying vec2 v_texCoord;
varying vec4 v_color;
uniform sampler2D u_texture;
uniform float u_light;
void main() {
  vec4 color = v_color * texture2D(u_texture, v_texCoord);
  if (u_light > 0.5) {
    vec3 light = u_light > 1.5 ? color.rgb : color.rgb * color.a;
    gl_FragColor = vec4(light, max(light.r, max(light.g, light.b)));
  } else {
    gl_FragColor = color;
  }
}`;

/** `u_light`: off, additive with source alpha, additive with source ONE. */
const LIGHT_OFF = 0;
const LIGHT_SRC_ALPHA = 1;
const LIGHT_SRC_ONE = 2;

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Failed to create shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? "Shader compile failed");
  }
  return shader;
}

export class SpriteBatch {
  readonly gl: WebGLRenderingContext;
  private readonly program: WebGLProgram;
  private readonly vertexBuffer: WebGLBuffer;
  private readonly indexBuffer: WebGLBuffer;
  private readonly vertices = new Float32Array(MAX_SPRITES * FLOATS_PER_SPRITE);
  private readonly viewLocation: WebGLUniformLocation | null;
  private readonly lightLocation: WebGLUniformLocation | null;
  private readonly glTextures = new Map<SheetImage, WebGLTexture>();
  private sprites = 0;
  private currentSheet: SheetImage | null = null;
  private blendSrc = GL_SRC_ALPHA;
  private blendDst = GL_ONE_MINUS_SRC_ALPHA;
  private drawing = false;
  private readonly color = new Color(1, 1, 1, 1);

  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) throw new Error("WebGL is unavailable");
    this.gl = gl;
    const program = gl.createProgram();
    if (!program) throw new Error("Failed to create program");
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) ?? "Program link failed");
    }
    this.program = program;
    this.viewLocation = gl.getUniformLocation(program, "u_view");
    this.lightLocation = gl.getUniformLocation(program, "u_light");

    const vertexBuffer = gl.createBuffer();
    const indexBuffer = gl.createBuffer();
    if (!vertexBuffer || !indexBuffer) throw new Error("Failed to create buffers");
    this.vertexBuffer = vertexBuffer;
    this.indexBuffer = indexBuffer;
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.vertices.byteLength, gl.DYNAMIC_DRAW);
    const indices = new Uint16Array(MAX_SPRITES * 6);
    for (let sprite = 0, vertex = 0; sprite < MAX_SPRITES * 6; sprite += 6, vertex += 4) {
      indices[sprite] = vertex;
      indices[sprite + 1] = vertex + 1;
      indices[sprite + 2] = vertex + 2;
      indices[sprite + 3] = vertex + 2;
      indices[sprite + 4] = vertex + 3;
      indices[sprite + 5] = vertex;
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
  }

  /** Clears the canvas and maps `x0..x0+width, y0..y0+height` (game units) onto it. */
  begin(x0: number, y0: number, width: number, height: number): void {
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.uniform4f(this.viewLocation, x0, y0, 2 / width, 2 / height);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    const stride = FLOATS_PER_VERTEX * 4;
    const position = gl.getAttribLocation(this.program, "a_position");
    const texCoord = gl.getAttribLocation(this.program, "a_texCoord");
    const color = gl.getAttribLocation(this.program, "a_color");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(texCoord);
    gl.vertexAttribPointer(texCoord, 2, gl.FLOAT, false, stride, 8);
    gl.enableVertexAttribArray(color);
    gl.vertexAttribPointer(color, 4, gl.FLOAT, false, stride, 16);
    gl.enable(gl.BLEND);
    this.blendSrc = GL_SRC_ALPHA;
    this.blendDst = GL_ONE_MINUS_SRC_ALPHA;
    this.applyBlend();
    this.color.set(1, 1, 1, 1);
    this.drawing = true;
  }

  end(): void {
    this.flush();
    this.drawing = false;
  }

  dispose(): void {
    const gl = this.gl;
    for (const texture of this.glTextures.values()) gl.deleteTexture(texture);
    this.glTextures.clear();
    gl.deleteBuffer(this.vertexBuffer);
    gl.deleteBuffer(this.indexBuffer);
    gl.deleteProgram(this.program);
    // The canvas stays mounted and may get a new batch (React remounts effects), so its context is kept.
  }

  setColor(color: Color | number, g?: number, b?: number, a?: number): void {
    if (color instanceof Color) this.color.set(color.r, color.g, color.b, color.a);
    else this.color.set(color, g ?? 0, b ?? 0, a ?? 0);
  }

  getColor(): Color {
    return this.color.cpy();
  }

  setBlendFunction(src: number, dst: number): void {
    if (src === this.blendSrc && dst === this.blendDst) return;
    this.flush();
    this.blendSrc = src;
    this.blendDst = dst;
    this.applyBlend();
  }

  private applyBlend(): void {
    const gl = this.gl;
    if (this.blendDst === GL_ONE && (this.blendSrc === GL_SRC_ALPHA || this.blendSrc === GL_ONE)) {
      // Additive light: the shader premultiplies, so color and coverage both add.
      gl.uniform1f(this.lightLocation, this.blendSrc === GL_ONE ? LIGHT_SRC_ONE : LIGHT_SRC_ALPHA);
      gl.blendFuncSeparate(GL_ONE, GL_ONE, GL_ONE, GL_ONE);
      return;
    }
    gl.uniform1f(this.lightLocation, LIGHT_OFF);
    if (this.blendSrc === GL_SRC_ALPHA && this.blendDst === GL_ONE_MINUS_SRC_ALPHA) {
      gl.blendFuncSeparate(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA, GL_ONE, GL_ONE_MINUS_SRC_ALPHA);
    } else {
      // No ported effect uses another mode; coverage is left as it was.
      gl.blendFuncSeparate(this.blendSrc, this.blendDst, GL_ZERO, GL_ONE);
    }
  }

  /**
   * libGDX's overloads, told apart by argument count:
   * - `draw(textureOrRegion, x, y)`
   * - `draw(textureOrRegion, x, y, width, height)`
   * - `draw(region, x, y, originX, originY, width, height, scaleX, scaleY, rotation)`
   * - `draw(texture, x, y, originX, originY, width, height, scaleX, scaleY, rotation,
   *        srcX, srcY, srcWidth, srcHeight, flipX, flipY)`
   */
  draw(source: Texture | TextureRegion, x: number, y: number, ...rest: (number | boolean)[]): void {
    if (!this.drawing) return;
    if (source instanceof Texture) {
      const sheet = source.sheet;
      if (rest.length === 0 || rest.length === 2) {
        const width = rest.length ? (rest[0] as number) : source.width;
        const height = rest.length ? (rest[1] as number) : source.height;
        this.quad(sheet, x, y, 0, 0, width, height, 1, 1, 0,
          source.x / sheet.width, (source.y + source.height) / sheet.height,
          (source.x + source.width) / sheet.width, source.y / sheet.height);
        return;
      }
      const [originX, originY, width, height, scaleX, scaleY, rotation, srcX, srcY, srcWidth, srcHeight, flipX, flipY] =
        rest as [number, number, number, number, number, number, number, number, number, number, number, boolean, boolean];
      let u = (source.x + srcX) / sheet.width;
      let v = (source.y + srcY + srcHeight) / sheet.height;
      let u2 = (source.x + srcX + srcWidth) / sheet.width;
      let v2 = (source.y + srcY) / sheet.height;
      if (flipX) [u, u2] = [u2, u];
      if (flipY) [v, v2] = [v2, v];
      this.quad(sheet, x, y, originX, originY, width, height, scaleX, scaleY, rotation, u, v, u2, v2);
      return;
    }
    const sheet = source.texture;
    if (rest.length === 0 || rest.length === 2) {
      const width = rest.length ? (rest[0] as number) : source.regionWidth;
      const height = rest.length ? (rest[1] as number) : source.regionHeight;
      this.quad(sheet, x, y, 0, 0, width, height, 1, 1, 0, source.u, source.v2, source.u2, source.v);
      return;
    }
    const [originX, originY, width, height, scaleX, scaleY, rotation] = rest as number[];
    this.quad(sheet, x, y, originX, originY, width, height, scaleX, scaleY, rotation, source.u, source.v2, source.u2, source.v);
  }

  /** One sprite; (u, v) at the bottom-left corner and (u2, v2) at the top-right, as libGDX lays them out. */
  private quad(
    sheet: SheetImage,
    x: number,
    y: number,
    originX: number,
    originY: number,
    width: number,
    height: number,
    scaleX: number,
    scaleY: number,
    rotation: number,
    u: number,
    v: number,
    u2: number,
    v2: number,
  ): void {
    if (sheet !== this.currentSheet) {
      this.flush();
      this.currentSheet = sheet;
    } else if (this.sprites >= MAX_SPRITES) {
      this.flush();
    }
    const worldOriginX = x + originX;
    const worldOriginY = y + originY;
    let fx = -originX;
    let fy = -originY;
    let fx2 = width - originX;
    let fy2 = height - originY;
    if (scaleX !== 1 || scaleY !== 1) {
      fx *= scaleX;
      fy *= scaleY;
      fx2 *= scaleX;
      fy2 *= scaleY;
    }
    let x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number;
    if (rotation !== 0) {
      const cos = Math.cos((rotation * Math.PI) / 180);
      const sin = Math.sin((rotation * Math.PI) / 180);
      x1 = cos * fx - sin * fy;
      y1 = sin * fx + cos * fy;
      x2 = cos * fx - sin * fy2;
      y2 = sin * fx + cos * fy2;
      x3 = cos * fx2 - sin * fy2;
      y3 = sin * fx2 + cos * fy2;
      x4 = x1 + (x3 - x2);
      y4 = y3 - (y2 - y1);
    } else {
      x1 = fx; y1 = fy;
      x2 = fx; y2 = fy2;
      x3 = fx2; y3 = fy2;
      x4 = fx2; y4 = fy;
    }
    const { r, g, b, a } = this.color;
    const data = this.vertices;
    let index = this.sprites * FLOATS_PER_SPRITE;
    const put = (px: number, py: number, pu: number, pv: number) => {
      data[index++] = px + worldOriginX;
      data[index++] = py + worldOriginY;
      data[index++] = pu;
      data[index++] = pv;
      data[index++] = r;
      data[index++] = g;
      data[index++] = b;
      data[index++] = a;
    };
    put(x1, y1, u, v);
    put(x2, y2, u, v2);
    put(x3, y3, u2, v2);
    put(x4, y4, u2, v);
    this.sprites += 1;
  }

  private glTexture(sheet: SheetImage): WebGLTexture | null {
    const cached = this.glTextures.get(sheet);
    if (cached) return cached;
    if (!sheet.image) return null;
    const gl = this.gl;
    const texture = gl.createTexture();
    if (!texture) return null;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sheet.image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.glTextures.set(sheet, texture);
    return texture;
  }

  flush(): void {
    if (this.sprites === 0 || !this.currentSheet) {
      this.sprites = 0;
      return;
    }
    const texture = this.glTexture(this.currentSheet);
    const gl = this.gl;
    if (texture) {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertices.subarray(0, this.sprites * FLOATS_PER_SPRITE));
      gl.drawElements(gl.TRIANGLES, this.sprites * 6, gl.UNSIGNED_SHORT, 0);
    }
    this.sprites = 0;
  }
}
