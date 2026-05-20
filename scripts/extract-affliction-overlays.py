#!/usr/bin/env python3
"""Extract STS2 card affliction overlay textures from the local PCK."""

from __future__ import annotations

import argparse
import math
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
ANIMATION_FRAMES = 24
ANIMATION_DURATION_MS = 70
ANIMATION_LOOP_SECONDS = 2.0
SHADER_RENDER_SIZE = 512

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


def polar_coordinates(
    u: float,
    v: float,
    center: tuple[float, float] = (0.5, 0.5),
    zoom: float = 1.0,
    repeat: float = 1.0,
) -> tuple[float, float]:
    dx = u - center[0]
    dy = v - center[1]
    radius = math.sqrt(dx * dx + dy * dy) * 2.0 * zoom
    angle = math.atan2(dy, dx) / (math.pi * 2.0)
    return radius % 1.0, (angle * repeat) % 1.0


def rotate_uv(
    u: float,
    v: float,
    pivot: tuple[float, float],
    angle: float,
) -> tuple[float, float]:
    u -= pivot[0]
    v -= pivot[1]
    sin_a = math.sin(angle)
    cos_a = math.cos(angle)
    rotated_u = u * sin_a + v * cos_a
    rotated_v = -u * cos_a + v * sin_a
    return rotated_u + pivot[0], rotated_v + pivot[1]


def sample_clamp(image, u: float, v: float) -> tuple[int, int, int, int]:
    x = max(0, min(image.width - 1, int(u * image.width)))
    y = max(0, min(image.height - 1, int(v * image.height)))
    return image.getpixel((x, y))


def gradient_sample(
    stops: list[tuple[float, tuple[float, float, float]]],
    t: float,
) -> tuple[float, float, float]:
    if t <= stops[0][0]:
        return stops[0][1]
    for (left_t, left_color), (right_t, right_color) in zip(stops, stops[1:]):
        if t <= right_t:
            return lerp_color(left_color, right_color, (t - left_t) / (right_t - left_t))
    return stops[-1][1]


def curve_sample(points: list[tuple[float, float]], x: float) -> float:
    if x <= points[0][0]:
        return points[0][1]
    for (left_x, left_y), (right_x, right_y) in zip(points, points[1:]):
        if x <= right_x:
            if left_x == right_x:
                return right_y
            t = (x - left_x) / (right_x - left_x)
            return left_y + (right_y - left_y) * t
    return points[-1][1]


def shader_source(image, size: int = SHADER_RENDER_SIZE):
    if Image is None:
        raise RuntimeError("Pillow is required to build shader textures")
    image = image.convert("RGBA")
    if max(image.size) <= size:
        return image
    resampling = getattr(Image, "Resampling", Image).LANCZOS
    return image.resize((size, size), resampling)


def save_animation(frames, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        output,
        "WEBP",
        save_all=True,
        append_images=frames[1:],
        duration=ANIMATION_DURATION_MS,
        loop=0,
        lossless=True,
        method=6,
    )


def animation_times() -> list[float]:
    return [
        (frame / ANIMATION_FRAMES) * ANIMATION_LOOP_SECONDS
        for frame in range(ANIMATION_FRAMES)
    ]


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


def render_bound_shader(image, time: float):
    source = shader_source(image)
    output = Image.new("RGBA", source.size)
    src = source.load()
    dst = output.load()
    vertex = (0.51294047, 0.819067, 0.24793532)
    vertex_alpha = 0.78431374

    for y in range(source.height):
        v = y / source.height
        for x in range(source.width):
            r, _g, _b, alpha = src[x, y]
            if alpha == 0:
                continue
            _bright_r, bright_g, _bright_b, _bright_a = sample_repeat(source, 0.5 * time, 0.0)
            energy_multiplier = 1.0 + (bright_g / 255.0) * 0.5
            intensity = (r / 255.0) * energy_multiplier
            dst[x, y] = (
                clamp_channel(vertex[0] * 255 * intensity),
                clamp_channel(vertex[1] * 255 * intensity),
                clamp_channel(vertex[2] * 255 * intensity),
                clamp_channel(alpha * vertex_alpha),
            )

    return output


def render_bound_border_shader(noise, mask, time: float):
    noise_image = shader_source(noise)
    mask_image = shader_source(mask)
    output = Image.new("RGBA", mask_image.size)
    dst = output.load()
    vertex = (0.27396876, 0.5137255, 0.12941176)
    vertex_alpha = 0.76862746

    for y in range(mask_image.height):
        v = y / mask_image.height
        for x in range(mask_image.width):
            u = x / mask_image.width
            polar_u, polar_v = polar_coordinates(u, v)
            main_r, main_g, main_b, _main_a = sample_repeat(
                noise_image,
                polar_u + 0.25 * time,
                polar_v * 3.0,
            )
            _mask_r, _mask_g, _mask_b, mask_a = sample_clamp(mask_image, u, v)
            alpha = smoothstep(0.4, 1.0, (mask_a / 255.0) * vertex_alpha)
            if alpha <= 0:
                continue
            dst[x, y] = (
                clamp_channel((main_r / 255.0) * vertex[0] * 255),
                clamp_channel((main_g / 255.0) * vertex[1] * 255),
                clamp_channel((main_b / 255.0) * vertex[2] * 255),
                clamp_channel(alpha * 255),
            )

    return output


def render_entangled_main_shader(image, time: float):
    source = shader_source(image)
    output = Image.new("RGBA", source.size)
    dst = output.load()
    vertex = (0.84705883, 0.47843137, 0.35686275)
    vine_lut = [
        (0.09243698, (0.2234027, 0.0, 0.23524225)),
        (1.0, (1.0, 1.0, 1.0)),
    ]

    for y in range(source.height):
        v = y / source.height
        for x in range(source.width):
            u = x / source.width
            _dist_r, _dist_g, dist_b, _dist_a = sample_repeat(
                source,
                u,
                v + 0.175 * time,
            )
            distortion = (dist_b / 255.0) * 0.018
            main_r, main_g, _main_b, _main_a = sample_clamp(source, u, v)
            distorted_r, _distorted_g, _distorted_b, distorted_a = sample_clamp(
                source,
                u + distortion * (main_g / 255.0),
                v,
            )
            if distorted_a == 0:
                continue
            lut = gradient_sample(vine_lut, distorted_r / 255.0)
            dst[x, y] = (
                clamp_channel(vertex[0] * lut[0] * 255),
                clamp_channel(vertex[1] * lut[1] * 255),
                clamp_channel(vertex[2] * lut[2] * 255),
                distorted_a,
            )

    return output


def render_entangled_leaf_shader(image, time: float):
    source = image.convert("RGBA")
    output = Image.new("RGBA", source.size)
    dst = output.load()
    lut = [
        (0.0, (0.0, 0.0, 0.0)),
        (1.0, (0.047058824, 0.57254905, 0.50980395)),
    ]
    _rot_r, _rot_g, rot_b, _rot_a = sample_repeat(source, 0.0, 0.1 * time)
    rotation_factor = ((rot_b / 255.0) - 0.5) * 2.0
    rotation = 0.35 * rotation_factor * math.pi * 0.5

    for y in range(source.height):
        v = y / source.height
        for x in range(source.width):
            u = x / source.width
            rotated_u, rotated_v = rotate_uv(u, v, (0.5, 0.8), math.pi * 0.5 + rotation)
            r, _g, _b, alpha = sample_clamp(source, rotated_u, rotated_v)
            if alpha == 0:
                continue
            color = gradient_sample(lut, r / 255.0)
            dst[x, y] = (
                clamp_channel(color[0] * 255),
                clamp_channel(color[1] * 255),
                clamp_channel(color[2] * 255),
                alpha,
            )

    return output


def render_galvanized_shader(image, time: float):
    source = shader_source(image)
    output = Image.new("RGBA", source.size)
    src = source.load()
    dst = output.load()
    lut = [
        (0.21008404, (0.2, 0.8, 1.0)),
        (0.8935574, (0.9011674, 0.9920209, 1.0)),
    ]

    for y in range(source.height):
        v = y / source.height
        for x in range(source.width):
            u = x / source.width
            _blink_r, _blink_g, blink_b, _blink_a = sample_repeat(source, 0.67 * time, 0.0)
            blink = smoothstep(0.2, 0.8, blink_b / 255.0)
            polar_u, polar_v = polar_coordinates(u, v)
            _dist_r, _dist_g, dist_b, _dist_a = sample_repeat(
                source,
                polar_u - 0.3 * time,
                polar_v,
            )
            dist_b_norm = dist_b / 255.0
            offset = (dist_b_norm - 0.5) * -0.4
            distortion_x = (u + offset - 0.5) * dist_b_norm * -0.15
            distortion_y = (v - 0.5) * dist_b_norm * -0.15
            line_r, glow_g, _line_b, _line_a = sample_repeat(
                source,
                u + distortion_x,
                v + distortion_y,
            )
            _raw_r, _raw_g, _raw_b, raw_a = src[x, y]
            mask = smoothstep(0.7, 1.0, raw_a / 255.0)
            color = gradient_sample(lut, blink)
            alpha = max(line_r / 255.0, (glow_g / 255.0) * blink) * mask
            if alpha <= 0:
                continue
            dst[x, y] = (
                clamp_channel(color[0] * 255),
                clamp_channel(color[1] * 255),
                clamp_channel(color[2] * 255),
                clamp_channel(alpha * 255),
            )

    return output


def render_hexed_shader(image, time: float):
    source = shader_source(image)
    output = Image.new("RGBA", source.size)
    src = source.load()
    dst = output.load()
    main_color = (0.654902, 0.5137255, 0.9490196)
    bright_color = (0.76862746, 0.6745098, 0.9647059)
    border_color = (0.6175565, 0.11198568, 1.0)

    for y in range(source.height):
        v = y / source.height
        for x in range(source.width):
            u = x / source.width
            r, _g, _b, alpha = src[x, y]
            if alpha == 0:
                continue
            polar_u, polar_v = polar_coordinates(u, v)
            _noise_r, _noise_g, noise_b, _noise_a = sample_repeat(
                source,
                polar_u - 0.25 * time,
                polar_v + 0.1 * time,
            )
            noise = smoothstep(0.5, 0.7, noise_b / 255.0)
            inner = lerp_color(main_color, bright_color, noise)
            color = lerp_color(border_color, inner, r / 255.0)
            dst[x, y] = (
                clamp_channel(color[0] * 255),
                clamp_channel(color[1] * 255),
                clamp_channel(color[2] * 255),
                alpha,
            )

    return output


def render_ringing_shader(image, time: float):
    source = shader_source(image)
    output = Image.new("RGBA", source.size)
    src = source.load()
    dst = output.load()
    frac = (time * 0.4) % 1.0
    ring_base_r = curve_sample([
        (0.0, 0.09756088),
        (0.118987344, 0.09756088),
        (0.162, 0.3),
        (0.6202532, 0.09756088),
        (1.0, 0.09756088),
    ], frac)
    ring_base_g = curve_sample([
        (0.0, 0.14634138),
        (0.15949368, 0.14634138),
        (0.2, 0.35),
        (0.6607595, 0.14634138),
        (1.0, 0.14634138),
    ], frac)
    ring_base_b = curve_sample([
        (0.0, 0.20121944),
        (0.2, 0.2),
        (0.24050632, 0.4),
        (0.6962026, 0.2),
        (1.0, 0.2),
    ], frac)
    thin_offset = curve_sample([(0.0, 0.5487804), (1.0, -0.30487812)], frac)
    thin_alpha = curve_sample([(0.0, 1.0), (1.0, 0.0)], frac)
    color = (184, 238, 240)

    for y in range(source.height):
        v = y / source.height
        for x in range(source.width):
            u = x / source.width
            r, g, b, _alpha = src[x, y]
            polar_u, polar_v = polar_coordinates(u, v, zoom=0.8)
            _pr, _pg, _pb, polar_alpha = sample_repeat(
                source,
                polar_u * 0.5 + thin_offset,
                polar_v * 0.5,
            )
            final_alpha = max(
                (r / 255.0) * ring_base_r,
                (g / 255.0) * ring_base_g,
                (b / 255.0) * ring_base_b,
                (polar_alpha / 255.0) * thin_alpha,
            )
            final_alpha = max(0.0, (final_alpha - 0.035) * 1.8)
            if final_alpha <= 0:
                continue
            dst[x, y] = (
                color[0],
                color[1],
                color[2],
                clamp_channel(min(final_alpha, 0.72) * 255),
            )

    return output


def render_smog_shader(noise, mask, time: float, outer: bool):
    noise_image = shader_source(noise)
    mask_image = shader_source(mask)
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

    for y in range(mask_image.height):
        v = y / mask_image.height
        rotated_v = 1.0 - v
        for x in range(mask_image.width):
            u = x / mask_image.width
            rotated_u = 1.0 - u
            main_tex = sample_repeat(
                noise_image,
                rotated_u * main_st[0] + main_st[2] * time,
                rotated_v * main_st[1] + main_st[3] * time,
            )
            secondary_tex = sample_repeat(
                noise_image,
                rotated_u * secondary_st[0] + secondary_st[2] * time,
                rotated_v * secondary_st[1] + secondary_st[3] * time,
            )
            mask_r, mask_g, _mask_b, _mask_a = mask_pixels[x, y]
            smoke_alpha = (
                (main_tex[0] / 255.0) * 0.7 + (secondary_tex[0] / 255.0) * 0.3
            ) * (mask_r / 255.0)
            smoke_alpha = smoothstep(0.0, 1.0, smoke_alpha)
            color = gradient_sample(gradient, smoke_alpha)
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


def build_animated_flipbook(source, columns: int, rows: int):
    image = source.convert("RGBA")
    frame_width = image.width // columns
    frame_height = image.height // rows
    frames = []
    for row in range(rows):
        for column in range(columns):
            frames.append(image.crop((
                column * frame_width,
                row * frame_height,
                (column + 1) * frame_width,
                (row + 1) * frame_height,
            )))
    return frames


def render_galvanized_corner_frame(frame):
    source = frame.convert("RGBA")
    output = Image.new("RGBA", source.size)
    dst = output.load()
    lut = [
        (0.0, (0.23036289, 0.74746776, 1.0)),
        (1.0, (1.2731656, 1.3172153, 1.353256)),
    ]
    for y in range(source.height):
        for x in range(source.width):
            r, _g, _b, alpha = source.getpixel((x, y))
            if alpha == 0:
                continue
            color = gradient_sample(lut, r / 255.0)
            dst[x, y] = (
                clamp_channel(color[0] * 255),
                clamp_channel(color[1] * 255),
                clamp_channel(color[2] * 255),
                alpha,
            )
    return output


def write_shader_animations(output_root: Path, dry_run: bool) -> int:
    animations = [
        (
            output_root / "entangled/entangled_main.webp",
            output_root / "entangled/entangled_main_shader.webp",
            lambda image, time: render_entangled_main_shader(image, time),
        ),
        (
            output_root / "entangled/entangled_leaf.webp",
            output_root / "entangled/entangled_leaf_shader.webp",
            lambda image, time: render_entangled_leaf_shader(image, time),
        ),
        (
            output_root / "bound/bound_main.webp",
            output_root / "bound/bound_main_shader.webp",
            lambda image, time: render_bound_shader(image, time),
        ),
        (
            output_root / "galvanized/galvanized_main.webp",
            output_root / "galvanized/galvanized_main_shader.webp",
            lambda image, time: render_galvanized_shader(image, time),
        ),
        (
            output_root / "hexed/hexed_main.webp",
            output_root / "hexed/hexed_main_shader.webp",
            lambda image, time: render_hexed_shader(image, time),
        ),
        (
            output_root / "ringing/ringing_main.webp",
            output_root / "ringing/ringing_main_shader.webp",
            lambda image, time: render_ringing_shader(image, time),
        ),
    ]
    written = 0
    for source, output, render in animations:
        if dry_run:
            print(f"would write {output}")
            continue
        image = Image.open(source).convert("RGBA")
        frames = [render(image, time) for time in animation_times()]
        save_animation(frames, output)
        written += 1

    bound_border_output = output_root / "bound/bound_border_shader.webp"
    if dry_run:
        print(f"would write {bound_border_output}")
    else:
        noise = Image.open(output_root / "common/vfx_noise_1.webp").convert("RGBA")
        mask = Image.open(output_root / "common/border_vignette.webp").convert("RGBA")
        frames = [render_bound_border_shader(noise, mask, time) for time in animation_times()]
        save_animation(frames, bound_border_output)
        written += 1

    smog_animations = [
        (
            output_root / "smog/smog_mask.webp",
            output_root / "smog/smog_main_shader.webp",
            False,
        ),
        (
            output_root / "smog/smog_mask_outer.webp",
            output_root / "smog/smog_outer_shader.webp",
            True,
        ),
    ]
    for mask, output, outer in smog_animations:
        if dry_run:
            print(f"would write {output}")
            continue
        noise = Image.open(output_root / "common/vfx_noise_1.webp").convert("RGBA")
        mask_image = Image.open(mask).convert("RGBA")
        frames = [render_smog_shader(noise, mask_image, time, outer) for time in animation_times()]
        save_animation(frames, output)
        written += 1

    corner_source = output_root / "galvanized/galvanized_lightning_corner.webp"
    corner_output = output_root / "galvanized/galvanized_lightning_corner_shader.webp"
    if dry_run:
        print(f"would write {corner_output}")
    else:
        corner_frames = [
            render_galvanized_corner_frame(frame)
            for frame in build_animated_flipbook(Image.open(corner_source), 2, 2)
        ]
        save_animation(corner_frames, corner_output)
        written += 1

    return written


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
    written += write_shader_animations(output_root, args.dry_run)
    print(f"affliction overlay textures written={written}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
