#!/usr/bin/env python3
"""Extract STS2 generic vertical popup + Yes/No ribbon buttons from the local PCK.

Outputs under public/images/sts2/ui/confirm/:
  - popup_vertical.png              (HSV-baked like vertical_popup.tscn)
  - popup_cancel_button.png         (아니요 / No — red ribbon)
  - popup_confirm_button.png        (예 / Yes — green ribbon)
  - popup_cancel_button_outline.png
  - popup_confirm_button_outline.png

HSV params match scenes/ui/vertical_popup.tscn and abandon_run_{yes,no}_button.tscn.
"""

from __future__ import annotations

import argparse
import math
import re
from pathlib import Path

from PIL import Image

from scripts.lib.ctex import ctex_to_image, parse_import_file
from scripts.lib.pck import PCKReader, default_pck_path

ATLAS_PATH_RE = re.compile(r'path="res://([^"]+)"')
ATLAS_REGION_RE = re.compile(r"region = Rect2\(([^)]+)\)")

# Godot mat3 columns from shaders/hsv.gdshader
RGB_TO_YIQ = (
    (0.2989, 0.5870, 0.1140),
    (0.5959, -0.2774, -0.3216),
    (0.2115, -0.5229, 0.3114),
)


def inv3(matrix: tuple[tuple[float, float, float], ...]) -> tuple[tuple[float, float, float], ...]:
    a, b, c = matrix[0]
    d, e, f = matrix[1]
    g, h, i = matrix[2]
    det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g)
    inv_det = 1.0 / det
    return (
        ((e * i - f * h) * inv_det, (c * h - b * i) * inv_det, (b * f - c * e) * inv_det),
        ((f * g - d * i) * inv_det, (a * i - c * g) * inv_det, (c * d - a * f) * inv_det),
        ((d * h - e * g) * inv_det, (b * g - a * h) * inv_det, (a * e - b * d) * inv_det),
    )


YIQ_TO_RGB = inv3(RGB_TO_YIQ)


def mul(
    matrix: tuple[tuple[float, float, float], ...],
    vector: tuple[float, float, float],
) -> tuple[float, float, float]:
    return (
        matrix[0][0] * vector[0] + matrix[0][1] * vector[1] + matrix[0][2] * vector[2],
        matrix[1][0] * vector[0] + matrix[1][1] * vector[1] + matrix[1][2] * vector[2],
        matrix[2][0] * vector[0] + matrix[2][1] * vector[1] + matrix[2][2] * vector[2],
    )


def apply_hsv(image: Image.Image, h: float, s: float, v: float) -> Image.Image:
    """Bake shaders/hsv.gdshader onto an RGBA image."""
    source = image.convert("RGBA")
    pixels = source.load()
    width, height = source.size
    output = Image.new("RGBA", (width, height))
    out_pixels = output.load()

    hue = (1.0 - h) * (2 * math.pi)
    cos_h = math.cos(hue)
    sin_h = math.sin(hue)
    hue_matrix = (
        (1.0, 0.0, 0.0),
        (0.0, cos_h, -sin_h),
        (0.0, sin_h, cos_h),
    )
    sat_matrix = (
        (1.0, 0.0, 0.0),
        (0.0, s, 0.0),
        (0.0, 0.0, s),
    )

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                out_pixels[x, y] = (0, 0, 0, 0)
                continue
            rgb = (r / 255.0, g / 255.0, b / 255.0)
            yiq = mul(RGB_TO_YIQ, rgb)
            yiq = mul(hue_matrix, yiq)
            yiq = mul(sat_matrix, yiq)
            yiq = (yiq[0] * v, yiq[1] * v, yiq[2] * v)
            rr, gg, bb = mul(YIQ_TO_RGB, yiq)
            out_pixels[x, y] = (
                max(0, min(255, int(rr * 255 + 0.5))),
                max(0, min(255, int(gg * 255 + 0.5))),
                max(0, min(255, int(bb * 255 + 0.5))),
                a,
            )
    return output


SPECS: dict[str, tuple[str, tuple[float, float, float] | None]] = {
    "popup_vertical": (
        "images/atlases/ui_atlas.sprites/popup_vertical.tres",
        (0.505, 1.0, 0.75),
    ),
    "popup_cancel_button": (
        "images/atlases/ui_atlas.sprites/popup_cancel_button.tres",
        (1.0, 0.75, 1.2),
    ),
    "popup_confirm_button": (
        "images/atlases/ui_atlas.sprites/popup_confirm_button.tres",
        (0.75, 1.2, 1.1),
    ),
    "popup_cancel_button_outline": (
        "images/atlases/compressed.sprites/popup_cancel_button_outline.tres",
        None,
    ),
    "popup_confirm_button_outline": (
        "images/atlases/compressed.sprites/popup_confirm_button_outline.tres",
        None,
    ),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pck", default=default_pck_path(), help="Path to Slay the Spire 2.pck")
    parser.add_argument(
        "--output",
        default="public/images/sts2/ui/confirm",
        help="Output directory",
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def open_import_image(reader: PCKReader, import_path: str) -> Image.Image:
    ctex_path = parse_import_file(reader.read_file(import_path))
    if not ctex_path:
        raise ValueError(f"Could not resolve .ctex path from {import_path}")
    image = ctex_to_image(reader.read_file(ctex_path))
    if image is None:
        raise ValueError(f"Could not decode {ctex_path}")
    return image


def crop_atlas_sprite(reader: PCKReader, tres_path: str) -> Image.Image:
    text = reader.read_file(tres_path).decode("utf-8", errors="replace")
    atlas_match = ATLAS_PATH_RE.search(text)
    region_match = ATLAS_REGION_RE.search(text)
    if not atlas_match or not region_match:
        raise ValueError(f"Could not parse atlas sprite {tres_path}")
    atlas_image = open_import_image(reader, f"{atlas_match.group(1)}.import")
    x, y, width, height = [
        int(float(part.strip()))
        for part in region_match.group(1).split(",")
    ]
    return atlas_image.crop((x, y, x + width, y + height))


def main() -> None:
    args = parse_args()
    output_root = Path(args.output)
    extracted = 0
    skipped = 0

    with PCKReader(args.pck) as reader:
        for name, (tres_path, hsv) in SPECS.items():
            output_path = output_root / f"{name}.png"
            if output_path.exists() and not args.force and not args.dry_run:
                skipped += 1
                continue
            try:
                image = crop_atlas_sprite(reader, tres_path)
                if hsv is not None:
                    image = apply_hsv(image, *hsv)
            except Exception as exc:
                print(f"skip {tres_path}: {exc}")
                skipped += 1
                continue

            if args.dry_run:
                print(f"would write {output_path} ({image.size[0]}x{image.size[1]})")
                extracted += 1
                continue

            output_path.parent.mkdir(parents=True, exist_ok=True)
            image.save(output_path)
            extracted += 1
            print(f"wrote {output_path} ({image.size[0]}x{image.size[1]})")

    print(f"done: {extracted} extracted, {skipped} skipped")


if __name__ == "__main__":
    main()
