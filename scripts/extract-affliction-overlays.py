#!/usr/bin/env python3
"""Extract STS2 card affliction overlay textures from the local PCK."""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.lib.ctex import ctex_to_image, parse_import_file
from scripts.lib.pck import PCKReader, default_pck_path

try:
    from PIL import Image, ImageChops
except ImportError:  # pragma: no cover
    Image = None  # type: ignore
    ImageChops = None  # type: ignore


OUT_ROOT = ROOT / "public/images/sts2/affliction-overlays"

TEXTURES: dict[str, list[str]] = {
    "common": [
        "images/vfx/ui/ui_card_mask.png",
        "images/vfx/ui/card/ui_card_border_vignette.png",
        "images/vfx/ui/card/ui_card_border_glow.png",
        "images/vfx/noise/vfx_noise_1.png",
    ],
    "bound": [
        "images/vfx/ui/card/afflictions/bound/ui_card_bound_main.png",
    ],
    "entangled": [
        "images/vfx/ui/card/afflictions/entangled/ui_card_entangled_main.png",
        "images/vfx/ui/card/afflictions/entangled/ui_card_entangled_leaf.png",
    ],
    "galvanized": [
        "images/vfx/ui/card/afflictions/galvanized/ui_card_galvanized_main.png",
        "images/vfx/ui/card/afflictions/galvanized/ui_card_galvanized_lightning_corner_flipbook.png",
    ],
    "hexed": [
        "images/vfx/ui/card/afflictions/hexed/ui_card_hexed_main.png",
    ],
    "ringing": [
        "images/vfx/ui/card/afflictions/ringing/ui_card_ringing_main.png",
        "images/vfx/ui/card/afflictions/ringing/ui_card_ringing_beast_frame_horns_only.png",
    ],
    "smog": [
        "images/vfx/ui/card/afflictions/smog/ui_card_smog_mask.png",
        "images/vfx/ui/card/afflictions/smog/ui_card_smog_mask_outer.png",
    ],
}


@dataclass(frozen=True)
class Target:
    group: str
    source: str
    output: Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pck", default=default_pck_path(), help="Path to Slay the Spire 2.pck")
    parser.add_argument("--output-root", default=str(OUT_ROOT), help="Texture output directory")
    parser.add_argument("--force", action="store_true", help="Rewrite existing output files")
    parser.add_argument("--dry-run", action="store_true", help="List work without writing files")
    return parser.parse_args()


def target_name(source: str) -> str:
    return Path(source).stem.removeprefix("ui_card_").replace("_flipbook", "")


def build_targets(output_root: Path) -> list[Target]:
    targets: list[Target] = []
    for group, sources in TEXTURES.items():
        for source in sources:
            targets.append(Target(group, source, output_root / group / f"{target_name(source)}.webp"))
    return targets


def extract_image(reader: PCKReader, source: str):
    import_path = f"{source}.import"
    if import_path not in reader.entries:
        raise FileNotFoundError(f"missing import: {import_path}")
    ctex_path = parse_import_file(reader.read_file(import_path))
    if not ctex_path or ctex_path not in reader.entries:
        raise FileNotFoundError(f"missing ctex for {source}: {ctex_path}")
    image = ctex_to_image(reader.read_file(ctex_path))
    if image is None:
        raise ValueError(f"unsupported texture payload: {ctex_path}")
    return image


def channel_alpha(image, color: tuple[int, int, int], mode: str):
    if Image is None or ImageChops is None:
        raise RuntimeError("Pillow is required to build preview textures")

    r, g, b, _a = image.convert("RGBA").split()
    if mode == "rg":
        alpha = ImageChops.lighter(r, g)
        alpha = alpha.point(lambda v: max(0, min(255, int((v - 18) * 2.4))))
    else:
        alpha = ImageChops.lighter(ImageChops.lighter(r, g), b)
        alpha = alpha.point(lambda v: max(0, min(190, int((v - 20) * 1.5))))
    base = Image.new("RGBA", image.size, (*color, 0))
    base.putalpha(alpha)
    return base


def clamp_channel(value: float) -> int:
    return max(0, min(255, int(round(value))))


def lerp_color(
    a: tuple[float, float, float],
    b: tuple[float, float, float],
    t: float,
) -> tuple[float, float, float]:
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def smoothstep(edge0: float, edge1: float, value: float) -> float:
    if edge0 == edge1:
        return 1.0 if value >= edge1 else 0.0
    t = max(0.0, min(1.0, (value - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)


def sample_repeat(image, u: float, v: float) -> tuple[int, int, int, int]:
    x = int((u % 1.0) * image.width) % image.width
    y = int((v % 1.0) * image.height) % image.height
    return image.getpixel((x, y))


def build_bound_preview(image):
    if Image is None:
        raise RuntimeError("Pillow is required to build preview textures")

    source = image.convert("RGBA")
    output = Image.new("RGBA", source.size)
    src = source.load()
    dst = output.load()
    vertex = (0.51294047, 0.819067, 0.24793532)
    vertex_alpha = 0.78431374

    for y in range(source.height):
        for x in range(source.width):
            r, _g, _b, alpha = src[x, y]
            if alpha == 0:
                continue
            _bright_r, bright_g, _bright_b, _bright_a = sample_repeat(
                source,
                (x / source.width) * 0.0 + 0.5,
                y / source.height,
            )
            energy_multiplier = 1.0 + (bright_g / 255.0) * 0.5
            intensity = (r / 255.0) * energy_multiplier
            dst[x, y] = (
                clamp_channel(vertex[0] * 255 * intensity),
                clamp_channel(vertex[1] * 255 * intensity),
                clamp_channel(vertex[2] * 255 * intensity),
                clamp_channel(alpha * vertex_alpha),
            )

    return output


def build_hexed_preview(image):
    if Image is None:
        raise RuntimeError("Pillow is required to build preview textures")

    source = image.convert("RGBA")
    output = Image.new("RGBA", source.size)
    src = source.load()
    dst = output.load()
    main_color = (0.654902, 0.5137255, 0.9490196)
    bright_color = (0.76862746, 0.6745098, 0.9647059)
    border_color = (0.6175565, 0.11198568, 1.0)

    for y in range(source.height):
        for x in range(source.width):
            r, _g, b, alpha = src[x, y]
            if alpha == 0:
                continue
            noise = smoothstep(0.5, 0.7, b / 255.0)
            inner = lerp_color(main_color, bright_color, noise)
            color = lerp_color(border_color, inner, r / 255.0)
            dst[x, y] = (
                clamp_channel(color[0] * 255),
                clamp_channel(color[1] * 255),
                clamp_channel(color[2] * 255),
                alpha,
            )

    return output


def build_entangled_preview(image):
    if Image is None:
        raise RuntimeError("Pillow is required to build preview textures")

    source = image.convert("RGBA")
    output = Image.new("RGBA", source.size)
    src = source.load()
    dst = output.load()
    dark = (132, 61, 39)
    bright = (230, 118, 64)

    for y in range(source.height):
        for x in range(source.width):
            r, g, b, alpha = src[x, y]
            if alpha == 0:
                continue
            intensity = max(r, g, b) / 255.0
            color = lerp_color(dark, bright, min(1.0, intensity * 1.2))
            dst[x, y] = (
                clamp_channel(color[0]),
                clamp_channel(color[1]),
                clamp_channel(color[2]),
                clamp_channel(alpha * 0.82),
            )

    return output


def build_ringing_preview(image):
    if Image is None:
        raise RuntimeError("Pillow is required to build preview textures")

    source = image.convert("RGBA")
    output = Image.new("RGBA", source.size)
    src = source.load()
    dst = output.load()
    color = (181, 241, 244)

    for y in range(source.height):
        for x in range(source.width):
            r, g, b, _alpha = src[x, y]
            channel_alpha_value = max(r * 0.42, g * 0.46, b * 0.55)
            channel_alpha_value = max(0.0, (channel_alpha_value - 48.0) * 1.7)
            if channel_alpha_value <= 0:
                continue
            dst[x, y] = (*color, clamp_channel(min(channel_alpha_value, 170)))

    return output


def build_smog_preview(noise, mask, outer: bool):
    if Image is None:
        raise RuntimeError("Pillow is required to build preview textures")

    noise_image = noise.convert("RGBA")
    mask_image = mask.convert("RGBA")
    output = Image.new("RGBA", mask_image.size)
    mask_pixels = mask_image.load()
    dst = output.load()
    main_st = (0.4, 0.76, 0.43, 0.4) if outer else (0.5, 0.75, 0.35, 0.45)
    secondary_st = (0.67, 0.5, 0.7, 0.1) if outer else (0.75, 0.5, 0.5, -0.1)
    gradient = [
        (0.10084034, (0.22166497, 0.056894522, 0.14145814)),
        (0.859944, (0.5254902, 0.4, 0.49019608)),
        (0.9579832, (0.64256185, 0.5156685, 0.6068731)),
    ]

    def gradient_color(t: float) -> tuple[float, float, float]:
        if t <= gradient[0][0]:
            return gradient[0][1]
        for (left_t, left_color), (right_t, right_color) in zip(gradient, gradient[1:]):
            if t <= right_t:
                return lerp_color(left_color, right_color, (t - left_t) / (right_t - left_t))
        return gradient[-1][1]

    for y in range(mask_image.height):
        v = y / mask_image.height
        rotated_v = 1.0 - v
        for x in range(mask_image.width):
            u = x / mask_image.width
            rotated_u = 1.0 - u
            main_tex = sample_repeat(
                noise_image,
                rotated_u * main_st[0],
                rotated_v * main_st[1] + main_st[3],
            )
            secondary_tex = sample_repeat(
                noise_image,
                rotated_u * secondary_st[0],
                rotated_v * secondary_st[1] + secondary_st[3],
            )
            mask_r, mask_g, _mask_b, _mask_a = mask_pixels[x, y]
            smoke_alpha = (
                (main_tex[0] / 255.0) * 0.7 + (secondary_tex[0] / 255.0) * 0.3
            ) * (mask_r / 255.0)
            color = gradient_color(smoke_alpha)
            alpha = smoke_alpha + (mask_g / 255.0)
            if alpha <= 0:
                continue
            dst[x, y] = (
                clamp_channel(color[0] * 255),
                clamp_channel(color[1] * 255),
                clamp_channel(color[2] * 255),
                clamp_channel(min(alpha, 1.0) * 255),
            )

    return output


def write_preview_textures(output_root: Path, dry_run: bool) -> int:
    previews = [
        {
            "source": output_root / "bound/bound_main.webp",
            "output": output_root / "bound/bound_main_preview.webp",
            "build": build_bound_preview,
        },
        {
            "source": output_root / "entangled/entangled_main.webp",
            "output": output_root / "entangled/entangled_main_preview.webp",
            "build": build_entangled_preview,
        },
        {
            "source": output_root / "galvanized/galvanized_main.webp",
            "output": output_root / "galvanized/galvanized_main_preview.webp",
            "build": lambda image: channel_alpha(image, (106, 220, 255), "rg"),
        },
        {
            "source": output_root / "hexed/hexed_main.webp",
            "output": output_root / "hexed/hexed_main_preview.webp",
            "build": build_hexed_preview,
        },
        {
            "source": output_root / "ringing/ringing_main.webp",
            "output": output_root / "ringing/ringing_main_preview.webp",
            "build": build_ringing_preview,
        },
        {
            "source": output_root / "common/vfx_noise_1.webp",
            "mask": output_root / "smog/smog_mask.webp",
            "output": output_root / "smog/smog_main_preview.webp",
            "build": lambda image, mask: build_smog_preview(image, mask, outer=False),
        },
        {
            "source": output_root / "common/vfx_noise_1.webp",
            "mask": output_root / "smog/smog_mask_outer.webp",
            "output": output_root / "smog/smog_outer_preview.webp",
            "build": lambda image, mask: build_smog_preview(image, mask, outer=True),
        },
    ]
    written = 0
    for preview in previews:
        output = preview["output"]
        if dry_run:
            print(f"would write {output}")
            continue
        image = Image.open(preview["source"]).convert("RGBA")
        if "mask" in preview:
            mask = Image.open(preview["mask"]).convert("RGBA")
            rendered = preview["build"](image, mask)
        else:
            rendered = preview["build"](image)
        rendered.save(output, "WEBP", lossless=True)
        written += 1
    return written


def main() -> int:
    args = parse_args()
    output_root = Path(args.output_root)
    written = 0

    with PCKReader(args.pck) as reader:
        for target in build_targets(output_root):
            if target.output.exists() and not args.force:
                continue
            if args.dry_run:
                print(f"would write {target.output}")
                continue
            image = extract_image(reader, target.source)
            target.output.parent.mkdir(parents=True, exist_ok=True)
            image.save(target.output, "WEBP", lossless=True)
            written += 1

    written += write_preview_textures(output_root, args.dry_run)
    print(f"affliction overlay textures written={written}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
