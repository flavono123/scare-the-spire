/**
 * The textures STS1's effects draw, repacked from the game's `vfx/vfx.atlas`
 * and loose images into one sheet by `scripts/extract-sts1-vfx.py`.
 *
 * `ImageMaster.X` and `ImageMaster.vfxAtlas.findRegion(name)` resolve the
 * same way the game's do. Regions are shared and mutable, as in libGDX: an
 * effect that flips one flips it for everyone until it flips it back.
 */
import manifest from "../../../../data/sts1/vfx-atlas.json";

interface SheetRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  offsetX: number;
  offsetY: number;
  origW: number;
  origH: number;
}

interface SheetTexture {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface SheetManifest {
  sheet: string;
  width: number;
  height: number;
  regions: Record<string, SheetRegion>;
  textures: Record<string, SheetTexture>;
  imageMaster: Record<string, { region: string } | { texture: string }>;
}

const SHEET = manifest as SheetManifest;

/** Everything is in one image; `Texture` and `TextureRegion` are rects in it. */
export interface SheetImage {
  readonly url: string;
  readonly width: number;
  readonly height: number;
  image: HTMLImageElement | null;
}

export const vfxSheet: SheetImage = {
  url: SHEET.sheet,
  width: SHEET.width,
  height: SHEET.height,
  image: null,
};

/** A loose game image (`ImageMaster.loadImage`), packed at `x, y` in the sheet. */
export class Texture {
  constructor(
    readonly sheet: SheetImage,
    readonly x: number,
    readonly y: number,
    readonly width: number,
    readonly height: number,
    readonly path: string,
  ) {}

  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }
}

export class TextureRegion {
  u: number;
  v: number;
  u2: number;
  v2: number;
  regionWidth: number;
  regionHeight: number;

  constructor(readonly texture: SheetImage, x: number, y: number, width: number, height: number) {
    this.u = x / texture.width;
    this.v = y / texture.height;
    this.u2 = (x + width) / texture.width;
    this.v2 = (y + height) / texture.height;
    this.regionWidth = width;
    this.regionHeight = height;
  }

  getRegionWidth(): number {
    return this.regionWidth;
  }

  getRegionHeight(): number {
    return this.regionHeight;
  }

  flip(x: boolean, y: boolean): void {
    if (x) {
      const swap = this.u;
      this.u = this.u2;
      this.u2 = swap;
    }
    if (y) {
      const swap = this.v;
      this.v = this.v2;
      this.v2 = swap;
    }
  }

  isFlipX(): boolean {
    return this.u > this.u2;
  }

  isFlipY(): boolean {
    return this.v > this.v2;
  }
}

/** A packed atlas region: whitespace trimmed, `offsetX/Y` from the original's bottom-left. */
export class AtlasRegion extends TextureRegion {
  offsetX: number;
  offsetY: number;
  readonly packedWidth: number;
  readonly packedHeight: number;
  readonly originalWidth: number;
  readonly originalHeight: number;

  constructor(texture: SheetImage, readonly name: string, region: SheetRegion) {
    super(texture, region.x, region.y, region.w, region.h);
    this.offsetX = region.offsetX;
    this.offsetY = region.offsetY;
    this.packedWidth = region.w;
    this.packedHeight = region.h;
    this.originalWidth = region.origW;
    this.originalHeight = region.origH;
  }

  flip(x: boolean, y: boolean): void {
    super.flip(x, y);
    if (x) this.offsetX = this.originalWidth - this.offsetX - this.packedWidth;
    if (y) this.offsetY = this.originalHeight - this.offsetY - this.packedHeight;
  }
}

const regions = new Map<string, AtlasRegion>();
const textures = new Map<string, Texture>();

function region(name: string): AtlasRegion | null {
  const cached = regions.get(name);
  if (cached) return cached;
  const entry = SHEET.regions[name];
  if (!entry) return null;
  const created = new AtlasRegion(vfxSheet, name, entry);
  regions.set(name, created);
  return created;
}

/** A loose image by its game path, e.g. `images/monsters/theBottom/boss/ghost/core.png`. */
export function loadImage(path: string): Texture {
  const cached = textures.get(path);
  if (cached) return cached;
  const entry = SHEET.textures[path];
  if (!entry) throw new Error(`STS1 VFX texture missing from the sheet: ${path}`);
  const created = new Texture(vfxSheet, entry.x, entry.y, entry.w, entry.h, path);
  textures.set(path, created);
  return created;
}

export const vfxAtlas = {
  findRegion(name: string): AtlasRegion {
    const found = region(name);
    if (!found) throw new Error(`STS1 VFX region missing from the sheet: ${name}`);
    return found;
  },
};

type ImageMasterFields = Record<string, AtlasRegion & Texture>;

/**
 * `ImageMaster.FIELD` as the game's static initializer sets it: an
 * `AtlasRegion` from vfx.atlas, or a `Texture` for loose images.
 */
export const ImageMaster: ImageMasterFields & { vfxAtlas: typeof vfxAtlas } = new Proxy(
  { vfxAtlas } as ImageMasterFields & { vfxAtlas: typeof vfxAtlas },
  {
    get(target, key) {
      if (key === "vfxAtlas") return vfxAtlas;
      if (typeof key !== "string") return undefined;
      const source = SHEET.imageMaster[key];
      if (!source) throw new Error(`ImageMaster.${key} is not in the STS1 VFX sheet`);
      return "region" in source ? vfxAtlas.findRegion(source.region) : loadImage(source.texture);
    },
  },
);

let loading: Promise<HTMLImageElement> | null = null;

export function loadVfxSheet(): Promise<HTMLImageElement> {
  if (vfxSheet.image) return Promise.resolve(vfxSheet.image);
  if (!loading) {
    loading = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new window.Image();
      image.decoding = "async";
      image.onload = () => {
        vfxSheet.image = image;
        resolve(image);
      };
      image.onerror = () => {
        loading = null;
        reject(new Error(`Failed to load ${vfxSheet.url}`));
      };
      image.src = vfxSheet.url;
    });
  }
  return loading;
}
