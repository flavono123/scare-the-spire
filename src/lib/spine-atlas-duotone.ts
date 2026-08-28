import type { Attachment, Texture, TextureAtlas } from "@esotericsoftware/spine-player";
import type { SpinePlayer } from "@/lib/spine-player-runtime";
import {
  hexToRgb255,
  remapDuotoneRgba,
} from "@/lib/duotone-pixels";

export type SpineAtlasDuotone = {
  shadow: string;
  highlight: string;
};

type TextureSnapshot = {
  original: ImageData;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
};

type MutableGlTexture = Texture & {
  _image: TexImageSource;
  update: (useMipMaps: boolean) => void;
};

const snapshots = new WeakMap<Texture, TextureSnapshot>();

function imageSize(image: TexImageSource): { width: number; height: number } {
  if ("naturalWidth" in image && image.naturalWidth) {
    return { width: image.naturalWidth, height: image.naturalHeight };
  }
  if ("width" in image && "height" in image) {
    return { width: Number(image.width), height: Number(image.height) };
  }
  return { width: 0, height: 0 };
}

function snapshotTexture(texture: Texture): TextureSnapshot | null {
  const cached = snapshots.get(texture);
  if (cached) return cached;
  const image = texture.getImage() as TexImageSource | undefined;
  if (!image) return null;
  const { width, height } = imageSize(image);
  if (width < 1 || height < 1) return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  try {
    ctx.drawImage(image as CanvasImageSource, 0, 0);
    const original = ctx.getImageData(0, 0, width, height);
    const entry = { original, canvas, ctx };
    snapshots.set(texture, entry);
    return entry;
  } catch {
    return null;
  }
}

function uploadCanvas(texture: Texture, canvas: HTMLCanvasElement) {
  const glTexture = texture as MutableGlTexture;
  if (typeof glTexture.update !== "function") return;
  glTexture._image = canvas;
  glTexture.update(false);
}

function addTexture(textures: Set<Texture>, texture: Texture | null | undefined) {
  if (texture) textures.add(texture);
}

function addFromAttachment(textures: Set<Texture>, attachment: Attachment | null) {
  if (!attachment) return;
  const textured = attachment as {
    region?: { texture?: Texture | null } | null;
    sequence?: { regions?: Array<{ texture?: Texture | null }> | null } | null;
  };
  addTexture(textures, textured.region?.texture ?? null);
  for (const region of textured.sequence?.regions ?? []) {
    addTexture(textures, region.texture ?? null);
  }
}

function collectAtlasTextures(player: SpinePlayer, atlasUrl?: string | null): Texture[] {
  const textures = new Set<Texture>();
  try {
    const atlas = atlasUrl ? player.assetManager?.get(atlasUrl) as TextureAtlas | undefined : undefined;
    for (const page of atlas?.pages ?? []) {
      addTexture(textures, page.texture);
    }
    const skeleton = player.skeleton;
    if (!skeleton?.data?.skins) return [...textures];
    for (const skin of skeleton.data.skins) {
      for (const entry of skin.getAttachments() ?? []) {
        addFromAttachment(textures, entry.attachment);
      }
    }
    for (const slot of skeleton.slots ?? []) {
      addFromAttachment(textures, slot.getAttachment());
    }
  } catch (error: unknown) {
    console.warn("Failed to collect Spine atlas textures:", error);
  }
  return [...textures];
}

export function neutralizeSpineSlotTint(player: SpinePlayer) {
  const skeleton = player.skeleton;
  if (!skeleton?.color || !skeleton.slots) return;
  skeleton.color.r = 1;
  skeleton.color.g = 1;
  skeleton.color.b = 1;
  for (const slot of skeleton.slots) {
    if (slot.color) {
      slot.color.r = 1;
      slot.color.g = 1;
      slot.color.b = 1;
    }
    if (slot.darkColor) {
      slot.darkColor.r = 0;
      slot.darkColor.g = 0;
      slot.darkColor.b = 0;
    }
  }
}

export function applySpineAtlasDuotone(
  player: SpinePlayer,
  colors: SpineAtlasDuotone | null,
  atlasUrl?: string | null,
) {
  const textures = collectAtlasTextures(player, atlasUrl);
  for (const texture of textures) {
    try {
      if (!colors) {
        const snapshot = snapshots.get(texture);
        if (!snapshot) continue;
        snapshot.ctx.putImageData(snapshot.original, 0, 0);
        uploadCanvas(texture, snapshot.canvas);
        continue;
      }
      const snapshot = snapshotTexture(texture);
      if (!snapshot) continue;
      const copy = new ImageData(
        new Uint8ClampedArray(snapshot.original.data),
        snapshot.original.width,
        snapshot.original.height,
      );
      remapDuotoneRgba(copy.data, hexToRgb255(colors.shadow), hexToRgb255(colors.highlight));
      snapshot.ctx.putImageData(copy, 0, 0);
      uploadCanvas(texture, snapshot.canvas);
    } catch (error: unknown) {
      console.warn("Failed to remap Spine atlas page:", error);
    }
  }
  if (colors) neutralizeSpineSlotTint(player);
}

export function restoreSpineAtlasDuotone(player: SpinePlayer | null, atlasUrl?: string | null) {
  if (!player) return;
  applySpineAtlasDuotone(player, null, atlasUrl);
}
