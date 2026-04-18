"""Godot 4.x CompressedTexture2D (.ctex) decoder.

Decodes:
- Plain GST2 WebP  (data_format=2, `path=` in .import)
- Plain GST2 PNG   (data_format=1)
- GPU-compressed BC7 (BPTC)  (img_format=22, `path.bptc=` in .import)
- GPU-compressed BC3 (S3TC/DXT5) (img_format=19, `path.s3tc=` in .import)

Returns a PIL.Image when decodable, else None.
"""
from __future__ import annotations

import io
import math
import re
import struct
from typing import Optional

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    Image = None  # type: ignore

try:
    import texture2ddecoder as _t2d
except ImportError:  # pragma: no cover
    _t2d = None


# Godot Image.Format enum values used by STS2 assets.
FORMAT_BPTC_RGBA = 22  # BC7
FORMAT_DXT5 = 19       # BC3

_CTEX_PATH_RE = re.compile(r'path(?:\.\w+)?\s*=\s*"res://([^"]+)"')


def parse_import_file(raw: bytes) -> Optional[str]:
    """Return the res-relative .ctex path referenced by a .import file.

    Handles both `path="..."` (plain) and `path.bptc="..."` / `path.s3tc="..."`
    variants. Returns the first matching path line.
    """
    text = raw.decode("utf-8", errors="replace")
    idx = text.find("[remap]")
    if idx >= 0:
        text = text[idx:]
    m = _CTEX_PATH_RE.search(text)
    return m.group(1) if m else None


def _extract_webp_png(raw: bytes):
    """Decode GST2 data_format 1 (PNG) or 2 (WebP) payloads."""
    if len(raw) < 56 or raw[:4] != b"GST2":
        return None
    data_format = struct.unpack_from("<I", raw, 36)[0]
    if data_format not in (1, 2):
        return None
    data_size = struct.unpack_from("<I", raw, 52)[0]
    payload = raw[56 : 56 + data_size]
    if data_format == 2 and payload[:4] == b"RIFF" and payload[8:12] == b"WEBP":
        return Image.open(io.BytesIO(payload)).convert("RGBA")
    if data_format == 1 and payload[:4] == b"\x89PNG":
        return Image.open(io.BytesIO(payload)).convert("RGBA")
    return None


def _extract_compressed(raw: bytes):
    """Decode GST2 with `data_format=0` (GPU-compressed texture)."""
    if _t2d is None or Image is None:
        return None
    if len(raw) < 56 or raw[:4] != b"GST2":
        return None
    logical_w = struct.unpack_from("<I", raw, 8)[0]
    logical_h = struct.unpack_from("<I", raw, 12)[0]
    data_format = struct.unpack_from("<I", raw, 36)[0]
    if data_format != 0:
        return None
    # Layout for GPU-compressed GST2 textures (BPTC/BC7, S3TC/BC3):
    #   off 40 uint16 aligned_width   (4-byte block aligned)
    #   off 42 uint16 aligned_height
    #   off 44-47      reserved/flags
    #   off 48 uint32  img_format     (Godot Image.Format enum)
    #   off 52+        block payload  (BC3 and BC7 both use 16B/4x4 block)
    aligned_w = struct.unpack_from("<H", raw, 40)[0]
    aligned_h = struct.unpack_from("<H", raw, 42)[0]
    img_format = struct.unpack_from("<I", raw, 48)[0]
    # Sanity: aligned dims should be ≥ logical and reasonable.
    if aligned_w < logical_w or aligned_w > logical_w + 16 or aligned_w > 8192:
        return None
    if aligned_h < logical_h or aligned_h > logical_h + 16 or aligned_h > 8192:
        return None
    bw = math.ceil(aligned_w / 4)
    bh = math.ceil(aligned_h / 4)
    block_size = 16  # BC3 and BC7 both use 16-byte 4x4 blocks.
    expected = bw * bh * block_size
    payload = raw[52 : 52 + expected]
    if len(payload) < expected:
        return None
    if img_format == FORMAT_BPTC_RGBA:
        pixels = _t2d.decode_bc7(payload, aligned_w, aligned_h)
    elif img_format == FORMAT_DXT5:
        pixels = _t2d.decode_bc3(payload, aligned_w, aligned_h)
    else:
        return None
    img = Image.frombytes("RGBA", (aligned_w, aligned_h), pixels, "raw", "BGRA")
    if (aligned_w, aligned_h) != (logical_w, logical_h):
        img = img.crop((0, 0, logical_w, logical_h))
    return img


def ctex_to_image(raw: bytes):
    """Decode any supported .ctex blob to a PIL.Image (RGBA), or None."""
    return _extract_webp_png(raw) or _extract_compressed(raw)
