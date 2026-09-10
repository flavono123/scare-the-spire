"""Rasterize STS1 card fonts the way FontHelper.prepFont does (FreeType stroker)."""

from __future__ import annotations

import json
from ctypes import byref
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

from freetype import (
    FT_Exception,
    FT_Glyph_StrokeBorder,
    FT_LOAD_DEFAULT,
    FT_LOAD_TARGET_LIGHT,
    FT_RENDER_MODE_NORMAL,
    FT_STROKER_LINECAP_ROUND,
    FT_STROKER_LINEJOIN_ROUND,
    Face,
    Stroker,
)
from PIL import Image

# FontHelper.initialize: hinting Slight, gamma 0.9, renderCount default 2.
LOAD_FLAGS = FT_LOAD_DEFAULT | FT_LOAD_TARGET_LIGHT
GAMMA = 0.9
RENDER_COUNT = 2
ATLAS_PAD = 1

# First language fontFile (title + description). Type plaque uses the later bold switch.
LOCALE_BODY_FONT = {
    "kor": "font/kor/GyeonggiCheonnyeonBatangBold.ttf",
    "jpn": "font/jpn/NotoSansCJKjp-Regular.otf",
    "zhs": "font/zhs/NotoSansMonoCJKsc-Regular.otf",
    "rus": "font/rus/FiraSansExtraCondensed-Regular.ttf",
    "tha": "font/tha/CSChatThaiUI.ttf",
}
LOCALE_TYPE_FONT = {
    "kor": "font/kor/GyeonggiCheonnyeonBatangBold.ttf",
    "jpn": "font/jpn/NotoSansCJKjp-Bold.otf",
    "zhs": "font/zhs/SourceHanSerifSC-Bold.otf",
    "rus": "font/rus/FiraSansExtraCondensed-Bold.ttf",
    "tha": "font/tha/CSChatThaiUI.ttf",
}
LATIN_BODY_FONT = "font/Kreon-Regular.ttf"
LATIN_TYPE_FONT = "font/Kreon-Bold.ttf"
ENERGY_FONT = "font/Kreon-Bold.ttf"

LATIN_PACK_LOCALES = ("eng", "deu", "fra", "ita", "spa", "ptb", "pol", "tur")
SPECIAL_PACK_LOCALES = ("kor", "jpn", "zhs", "rus", "tha")

# cardTitleFont: border 2, borderColor (0.35,0.35,0.35), shadow 3,3 a=0.25
TITLE_BORDER = 2
TITLE_BORDER_COLOR = (89, 89, 89, 255)
TITLE_SHADOW = (3, 3)
TITLE_SHADOW_COLOR = (0, 0, 0, 64)
# cardEnergyFont_L: border 4, borderColor (0.3,0.3,0.3), no extra shadow in that block
ENERGY_BORDER = 4
ENERGY_BORDER_COLOR = (77, 77, 77, 255)
# cardDescFont: border 0, shadow 1,1 quarter black
DESC_SHADOW = (1, 1)
DESC_SHADOW_COLOR = (0, 0, 0, 64)

FILL_WHITE = (255, 255, 255, 255)


def to_int(value: int) -> int:
    """libGDX FreeType.toInt — round 26.6 to pixels."""
    return (int(value) + 63) >> 6


def stroke_border(glyph, stroker, *, inside: bool = False, destroy: bool = False) -> None:
    error = FT_Glyph_StrokeBorder(
        byref(glyph._FT_Glyph),
        stroker._FT_Stroker,
        int(inside),
        int(destroy),
    )
    if error:
        raise FT_Exception(error)


def bitmap_to_image(bitmap, color: tuple[int, int, int, int], gamma: float) -> Image.Image:
    width, rows = bitmap.width, bitmap.rows
    if width == 0 or rows == 0:
        return Image.new("RGBA", (0, 0))
    pitch = abs(bitmap.pitch)
    buffer = bytes(bitmap.buffer)
    red, green, blue, alpha = color
    image = Image.new("RGBA", (width, rows), (0, 0, 0, 0))
    pixels = image.load()
    for y in range(rows):
        row = buffer[y * pitch : (y + 1) * pitch]
        for x in range(width):
            coverage = row[x] / 255.0
            if coverage <= 0:
                continue
            if gamma != 1:
                coverage = coverage**gamma
            pixels[x, y] = (red, green, blue, int(round(min(1.0, coverage) * alpha)))
    return image


@dataclass
class GlyphImage:
    image: Image.Image
    xoffset: int
    top: int
    xadvance: int


def render_glyph(
    face: Face,
    char: str,
    *,
    border: float = 0,
    border_color: tuple[int, int, int, int] = TITLE_BORDER_COLOR,
    fill: tuple[int, int, int, int] = FILL_WHITE,
    shadow: tuple[int, int] = (0, 0),
    shadow_color: tuple[int, int, int, int] = (0, 0, 0, 0),
) -> GlyphImage | None:
    if face.get_char_index(char) == 0 and char != "\0":
        return None
    face.load_char(char, LOAD_FLAGS)
    slot = face.glyph
    advance = to_int(slot.metrics.horiAdvance) + int(border)

    fill_glyph = slot.get_glyph()
    fill_bitmap = fill_glyph.to_bitmap(FT_RENDER_MODE_NORMAL, 0, False)
    fill_image = bitmap_to_image(fill_bitmap.bitmap, fill, GAMMA)
    left, top = fill_bitmap.left, fill_bitmap.top
    main = fill_image

    if border > 0:
        stroker = Stroker()
        stroker.set(
            int(border * 64),
            FT_STROKER_LINECAP_ROUND,
            FT_STROKER_LINEJOIN_ROUND,
            0,
        )
        border_glyph = slot.get_glyph()
        stroke_border(border_glyph, stroker, inside=False, destroy=False)
        border_bitmap = border_glyph.to_bitmap(FT_RENDER_MODE_NORMAL, 0, False)
        border_image = bitmap_to_image(border_bitmap.bitmap, border_color, GAMMA)
        offset_x = left - border_bitmap.left
        offset_y = -(top - border_bitmap.top)
        canvas = Image.new("RGBA", border_image.size, (0, 0, 0, 0))
        canvas.alpha_composite(border_image, (0, 0))
        for _ in range(RENDER_COUNT):
            canvas.alpha_composite(fill_image, (offset_x, offset_y))
        main = canvas
        left, top = border_bitmap.left, border_bitmap.top

    if (shadow[0] or shadow[1]) and shadow_color[3] > 0:
        shadow_x, shadow_y = shadow
        width = main.width + abs(shadow_x)
        height = main.height + abs(shadow_y)
        shadow_image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        shadow_pixels = shadow_image.load()
        main_pixels = main.load()
        red, green, blue, alpha = shadow_color
        paste_x, paste_y = max(shadow_x, 0), max(shadow_y, 0)
        for y in range(main.height):
            for x in range(main.width):
                main_a = main_pixels[x, y][3]
                if main_a == 0:
                    continue
                shadow_pixels[x + paste_x, y + paste_y] = (
                    red,
                    green,
                    blue,
                    int(main_a * (alpha / 255.0)),
                )
        dest = (max(-shadow_x, 0), max(-shadow_y, 0))
        for _ in range(RENDER_COUNT):
            shadow_image.alpha_composite(main, dest)
        main = shadow_image

    if main.width == 0 and char == " ":
        main = Image.new("RGBA", (max(advance, 1), 1), (0, 0, 0, 0))

    return GlyphImage(image=main, xoffset=left, top=top, xadvance=advance)


class RowPacker:
    def __init__(self, max_width: int = 2048, pad: int = ATLAS_PAD) -> None:
        self.max_width = max_width
        self.pad = pad
        self.x = pad
        self.y = pad
        self.row_height = 0
        self.width = pad
        self.height = pad
        self.entries: list[tuple[Image.Image, int, int]] = []

    def add(self, image: Image.Image) -> tuple[int, int]:
        if image.width == 0 or image.height == 0:
            return (0, 0)
        if self.x + image.width + self.pad > self.max_width:
            self.x = self.pad
            self.y += self.row_height + self.pad
            self.row_height = 0
        self.entries.append((image, self.x, self.y))
        self.row_height = max(self.row_height, image.height)
        self.width = max(self.width, self.x + image.width + self.pad)
        self.height = max(self.height, self.y + image.height + self.pad)
        origin = (self.x, self.y)
        self.x += image.width + self.pad
        return origin

    def build(self) -> Image.Image:
        page = Image.new("RGBA", (max(self.width, 1), max(self.height, 1)), (0, 0, 0, 0))
        for image, x, y in self.entries:
            page.alpha_composite(image, (x, y))
        return page


def face_metrics(face: Face) -> dict[str, int]:
    size = face.size
    return {
        "ascent": to_int(size.ascender),
        "descent": to_int(size.descender),
        "lineHeight": to_int(size.height),
    }


def probe_cap_height(face: Face) -> int:
    for char in ("万", "H", "가", "x"):
        if face.get_char_index(char) == 0:
            continue
        face.load_char(char, LOAD_FLAGS)
        return to_int(face.glyph.metrics.height)
    return 0


def collect_strings(value: Any, into: set[str]) -> None:
    if isinstance(value, str):
        into.update(value)
    elif isinstance(value, dict):
        for child in value.values():
            collect_strings(child, into)
    elif isinstance(value, list):
        for child in value:
            collect_strings(child, into)


def extra_charset() -> str:
    return (
        " 0123456789+-X×x%./:!?,;'\"()[]"
        + "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
    )


def render_role(
    face: Face,
    chars: Iterable[str],
    packer: RowPacker,
    *,
    size: int,
    border: float,
    border_color: tuple[int, int, int, int],
    shadow: tuple[int, int],
    shadow_color: tuple[int, int, int, int],
) -> dict[str, Any]:
    face.set_pixel_sizes(0, size)
    metrics = face_metrics(face)
    metrics["size"] = size
    metrics["capHeight"] = probe_cap_height(face) or size
    glyphs: dict[str, Any] = {}
    seen: set[str] = set()
    for char in chars:
        if not char or char in seen or char in "\n\r\t":
            continue
        seen.add(char)
        rendered = render_glyph(
            face,
            char,
            border=border,
            border_color=border_color,
            shadow=shadow,
            shadow_color=shadow_color,
        )
        if rendered is None:
            continue
        x, y = packer.add(rendered.image)
        glyphs[char] = {
            "x": x,
            "y": y,
            "w": rendered.image.width,
            "h": rendered.image.height,
            "xoff": rendered.xoffset,
            "top": rendered.top,
            "xadv": rendered.xadvance,
        }
    metrics["glyphs"] = glyphs
    return metrics


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
