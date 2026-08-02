#!/usr/bin/env python3
"""Extract STS2 character Form VFX into browser-ready static scenes."""
from __future__ import annotations

import argparse
import copy
import json
import math
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from lib.ctex import ctex_to_image, parse_import_file  # noqa: E402
from lib.godot_scene import parse_scene  # noqa: E402
from lib.pck import PCKReader, default_pck_path  # noqa: E402


SCENE_ROOT = ROOT / "public/generated/form-vfx/scenes"
TEXTURE_ROOT = ROOT / "public/images/sts2/form-vfx/runtime"
MANIFEST_PATH = ROOT / "data/sts2/character-form-vfx-assets.json"
COMMON_GLOW = "images/vfx/common/common_glow.png"
NOISE = "images/vfx/noise/vfx_noise_4.png"
SERPENT_SNAKES = "images/vfx/forms/serpent/form_serpent_snakes.png"
VOID_SPIKE = "images/vfx/forms/void/form_void_spike.png"
DEMON_PARTICLE_TEXTURES = {
    "images/vfx/shared_use/smoke_vfx.png": "demon/smoke_vfx.webp",
    "images/vfx/big_slash/big_slash_impact_core_flipbook.png": "demon/big_slash_impact_core_flipbook.webp",
    "images/vfx/fire_impact/fire_burst_ember_straight.png": "demon/fire_burst_ember_straight.webp",
}


@dataclass(frozen=True)
class FormSpec:
    slug: str
    card_id: str
    origin_character_id: str

    @property
    def scene_path(self) -> str:
        return f"scenes/vfx/forms/{self.slug}/vfx_{self.slug}_form_idle_vfx.tscn"


FORMS = (
    FormSpec("demon", "DEMON_FORM", "IRONCLAD"),
    FormSpec("serpent", "SERPENT_FORM", "SILENT"),
    FormSpec("void", "VOID_FORM", "REGENT"),
    FormSpec("reaper", "REAPER_FORM", "NECROBINDER"),
    FormSpec("echo", "ECHO_FORM", "DEFECT"),
)

CHARACTER_SCENES = {
    "IRONCLAD": "ironclad",
    "SILENT": "silent",
    "REGENT": "regent",
    "NECROBINDER": "necrobinder",
    "DEFECT": "defect",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pck", default=default_pck_path(), help="Path to Slay the Spire 2.pck")
    parser.add_argument("--force", action="store_true", help="Rewrite existing textures")
    parser.add_argument("--dry-run", action="store_true", help="Validate without writing")
    return parser.parse_args()


def public_url(path: Path) -> str:
    return "/" + path.relative_to(ROOT / "public").as_posix()


def write_json(path: Path, value: Any, dry_run: bool) -> None:
    text = json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n"
    if dry_run or (path.exists() and path.read_text() == text):
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)


def read_texture(reader: PCKReader, source_path: str) -> Image.Image:
    import_path = f"{source_path}.import"
    target = parse_import_file(reader.read_file(import_path))
    if not target or target not in reader.entries:
        raise FileNotFoundError(f"{source_path}: imported texture not found: {target}")
    image = ctex_to_image(reader.read_file(target))
    if image is None:
        raise ValueError(f"{source_path}: texture decode failed")
    return image.convert("RGBA")


def save_texture(image: Image.Image, name: str, force: bool, dry_run: bool) -> dict[str, Any]:
    path = TEXTURE_ROOT / name
    if not dry_run and (force or not path.exists()):
        path.parent.mkdir(parents=True, exist_ok=True)
        image.save(path, "WEBP", lossless=True, method=6)
    return {
        "height": image.height,
        "source": name,
        "src": public_url(path),
        "width": image.width,
    }


def mix(left: float, right: float, amount: float) -> float:
    return left + (right - left) * amount


def smoothstep(left: float, right: float, value: float) -> float:
    amount = max(0.0, min(1.0, (value - left) / (right - left)))
    return amount * amount * (3.0 - 2.0 * amount)


def sample_float_gradient(stops: tuple[tuple[float, float], ...], value: float) -> float:
    if value <= stops[0][0]:
        return stops[0][1]
    for index in range(1, len(stops)):
        right_at, right_value = stops[index]
        if value <= right_at:
            left_at, left_value = stops[index - 1]
            return mix(left_value, right_value, (value - left_at) / (right_at - left_at))
    return stops[-1][1]


def sample_gradient(stops: tuple[tuple[float, tuple[float, float, float]], ...], value: float) -> tuple[int, int, int]:
    if value <= stops[0][0]:
        color = stops[0][1]
    else:
        color = stops[-1][1]
        for index in range(1, len(stops)):
            right_at, right_color = stops[index]
            if value <= right_at:
                left_at, left_color = stops[index - 1]
                amount = (value - left_at) / max(0.0001, right_at - left_at)
                color = tuple(mix(left_color[channel], right_color[channel], amount) for channel in range(3))
                break
    return tuple(round(channel * 255) for channel in color)


def glow_texture(image: Image.Image) -> Image.Image:
    return Image.merge("RGBA", (
        Image.new("L", image.size, 255),
        Image.new("L", image.size, 255),
        Image.new("L", image.size, 255),
        image.getchannel("R"),
    ))


def lut_texture(
    image: Image.Image,
    stops: tuple[tuple[float, tuple[float, float, float]], ...],
) -> Image.Image:
    output = Image.new("RGBA", image.size)
    output.putdata([
        (*sample_gradient(stops, red / 255), alpha)
        for red, _green, _blue, alpha in image.getdata()
    ])
    return output


def sample_wrapped(pixels: Any, size: tuple[int, int], u: float, v: float) -> float:
    width, height = size
    return pixels[round((u % 1.0) * (width - 1)), round((v % 1.0) * (height - 1))][0] / 255


def form_noise_frame(
    noise: Image.Image,
    time: float,
    size: int,
    tiles_a: tuple[float, float, float, float],
    tiles_b: tuple[float, float, float, float],
    erosion: tuple[float, float],
    colors: tuple[tuple[float, tuple[float, float, float]], ...],
    mask: Callable[[float, float], float],
    overlay: Callable[[float, float], float],
    alpha: Callable[[float, float, float], float] = lambda _u, _v, value: value,
    initial_a: tuple[float, float] = (0, 0),
    initial_b: tuple[float, float] = (0, 0),
    polar: bool = False,
    polar_rotation: float = 0,
) -> Image.Image:
    noise_pixels = noise.load()
    output = Image.new("RGBA", (size, size))
    output_pixels = output.load()
    for y in range(size):
        v = y / max(1, size - 1)
        for x in range(size):
            u = x / max(1, size - 1)
            if polar:
                dx, dy = u - 0.5, v - 0.5
                source_u = math.hypot(dx, dy) * 2
                source_v = (math.atan2(dy, dx) / (math.pi * 2) + polar_rotation) % 1
            else:
                source_u, source_v = u, v
            a = sample_wrapped(
                noise_pixels,
                noise.size,
                source_u * tiles_a[0] + tiles_a[2] * time + initial_a[0],
                source_v * tiles_a[1] + tiles_a[3] * time + initial_a[1],
            )
            b = sample_wrapped(
                noise_pixels,
                noise.size,
                source_u * tiles_b[0] + tiles_b[2] * time + initial_b[0],
                source_v * tiles_b[1] + tiles_b[3] * time + initial_b[1],
            )
            value = ((a + b) * 0.5 + overlay(u, v)) * mask(u, v)
            value = smoothstep(erosion[0], erosion[0] + erosion[1], value)
            output_pixels[x, y] = (
                *sample_gradient(colors, value),
                round(max(0.0, min(1.0, alpha(u, v, value))) * 255),
            )
    return output


def animated_noise_sheet(noise: Image.Image, slug: str) -> Image.Image:
    frame_size = 256
    frames = 4
    sheet = Image.new("RGBA", (frame_size * frames, frame_size))
    if slug == "demon":
        render = lambda time: form_noise_frame(
            noise,
            time,
            frame_size,
            (0.75, 0.65, 1.25, 0),
            (1.5, 1.5, 2.25, 0),
            (0.25, 0.75),
            ((0.516, (1, 0, 0.177)), (1, (1, 0.485, 0))),
            lambda u, _v: smoothstep(0.1, 0.7, u) * min(1, (1 - u) / 0.25),
            lambda u, _v: smoothstep(0.549, 1, u),
            lambda u, _v, value: value * (1 - u) / 0.25,
        )
    else:
        serpent = slug == "serpent"
        render = lambda time: form_noise_frame(
            noise,
            time,
            frame_size,
            (1.25, 1, -0.5, 0) if serpent else (2.5, 2, -0.4, -0.025),
            (3, 1, -1, 0) if serpent else (1.5, 1, -0.9, 0.05),
            (0.13, 0.875) if serpent else (0.2, 1),
            (
                ((0, (0, 0.079, 0.045)), (0.622, (0, 0.412, 0.191)), (1, (0, 1, 0.293)))
                if serpent
                else ((0.306, (0.048, 0, 0.072)), (0.703, (0.52, 0, 0.65)), (1, (0.86, 0.12, 1)))
            ),
            lambda u, v: sample_float_gradient(
                ((0, 0), (0.26216215, 0.75), (1, 0)),
                math.hypot(u - 0.5, v - 0.5) * 2,
            ),
            lambda u, v: sample_float_gradient(
                ((0.12162162, 0), (0.75405407, 1)),
                math.hypot(u - 0.5, v - 0.5) * 2,
            ),
            initial_a=(0, 0.2) if serpent else (0, 0),
            initial_b=(0, 0.45) if serpent else (0, 0),
            polar=True,
            polar_rotation=0 if serpent else 0.25,
        )
    for index in range(frames):
        sheet.paste(render(index / frames), (index * frame_size, 0))
    return sheet


def node_path(node: dict[str, Any]) -> str:
    parent = node.get("parent")
    return "." if parent is None else node["name"] if parent == "." else f"{parent}/{node['name']}"


def vector_values(value: Any, fallback: tuple[float, float]) -> list[float]:
    if isinstance(value, dict) and value.get("$") == "Vector2":
        values = value.get("v")
        if isinstance(values, list) and len(values) >= 2:
            return [float(values[0]), float(values[1])]
    return [fallback[0], fallback[1]]


def rewrite_refs(value: Any, ext_ids: dict[str, str], sub_ids: dict[str, str]) -> Any:
    if isinstance(value, list):
        return [rewrite_refs(item, ext_ids, sub_ids) for item in value]
    if not isinstance(value, dict):
        return value
    kind = value.get("$")
    values = value.get("v")
    if kind in {"ExtResource", "SubResource"} and isinstance(values, list) and values:
        mapping = ext_ids if kind == "ExtResource" else sub_ids
        return {**value, "v": [mapping.get(str(values[0]), str(values[0])), *values[1:]]}
    return {key: rewrite_refs(item, ext_ids, sub_ids) for key, item in value.items()}


def referenced_ids(value: Any, kind: str) -> set[str]:
    if isinstance(value, list):
        return set().union(*(referenced_ids(item, kind) for item in value)) if value else set()
    if not isinstance(value, dict):
        return set()
    values = value.get("v")
    if value.get("$") == kind and isinstance(values, list) and values:
        return {str(values[0])}
    return set().union(*(referenced_ids(item, kind) for item in value.values())) if value else set()


def prune_resources(scene: dict[str, Any]) -> None:
    used_sub_ids = set().union(*(referenced_ids(node["props"], "SubResource") for node in scene["nodes"]))
    pending = list(used_sub_ids)
    while pending:
        resource = scene["resources"].get(pending.pop())
        if not resource:
            continue
        for ref in referenced_ids(resource["props"], "SubResource") - used_sub_ids:
            used_sub_ids.add(ref)
            pending.append(ref)
    scene["resources"] = {
        key: value for key, value in scene["resources"].items() if key in used_sub_ids
    }
    used_ext_ids = set().union(*(referenced_ids(node["props"], "ExtResource") for node in scene["nodes"]))
    used_ext_ids.update(
        set().union(*(referenced_ids(resource["props"], "ExtResource") for resource in scene["resources"].values()))
        if scene["resources"] else set()
    )
    scene["ext"] = {key: value for key, value in scene["ext"].items() if key in used_ext_ids}


def material_metadata(reader: PCKReader, path: str) -> dict[str, Any] | None:
    material = parse_scene(reader.read_file(path).decode("utf-8"), path)
    props = material["resource"]
    size = vector_values(props.get("shader_parameter/flipbook_size"), (1, 1))
    frame_count = props.get("shader_parameter/frame_count")
    pivot = vector_values(props.get("shader_parameter/pivot_offset"), (0, 0))
    if size == [1, 1] and frame_count is None and pivot == [0, 0]:
        return None
    return {
        "frameCount": float(frame_count) if isinstance(frame_count, (int, float)) else size[0] * size[1],
        "horizontal": int(size[0]),
        "pivot": pivot,
        "vertical": int(size[1]),
    }


def flatten_packed_roots(reader: PCKReader, scene: dict[str, Any]) -> None:
    for node in scene["nodes"]:
        instance = node.pop("instance", None)
        values = instance.get("v") if isinstance(instance, dict) and instance.get("$") == "ExtResource" else None
        if not isinstance(values, list) or not values:
            continue
        packed_id = str(values[0])
        packed_resource = scene["ext"].get(packed_id)
        if not packed_resource or packed_resource["type"] != "PackedScene":
            continue
        packed = parse_scene(
            reader.read_file(packed_resource["path"]).decode("utf-8"),
            packed_resource["path"],
        )
        if len(packed["nodes"]) != 1:
            raise ValueError(f'{packed_resource["path"]}: expected one packed root node')
        prefix = re.sub(r"[^a-zA-Z0-9_]", "_", node["name"])
        ext_ids = {key: f"{prefix}__{key}" for key in packed["ext"]}
        sub_ids = {key: f"{prefix}__{key}" for key in packed["resources"]}
        for key, resource in packed["ext"].items():
            copied = copy.deepcopy(resource)
            if copied["type"] == "Material":
                metadata = material_metadata(reader, copied["path"])
                if metadata:
                    copied["browserAnimation"] = metadata
            scene["ext"][ext_ids[key]] = copied
        for key, resource in packed["resources"].items():
            copied = copy.deepcopy(resource)
            copied["props"] = rewrite_refs(copied["props"], ext_ids, sub_ids)
            scene["resources"][sub_ids[key]] = copied
        packed_root = packed["nodes"][0]
        node["type"] = packed_root["type"]
        node["props"] = {
            **rewrite_refs(packed_root["props"], ext_ids, sub_ids),
            **node["props"],
        }


def character_visual_transforms(reader: PCKReader) -> dict[str, dict[str, list[float]]]:
    transforms = {}
    for character_id, scene_slug in CHARACTER_SCENES.items():
        scene_path = f"scenes/creature_visuals/{scene_slug}.tscn"
        scene_text = reader.read_file(scene_path).decode("utf-8")
        visuals_match = re.search(
            r'^\[node name="Visuals"[^\n]*parent="\."[^\n]*\]\n(?P<props>.*?)(?=\n\[node|\Z)',
            scene_text,
            re.MULTILINE | re.DOTALL,
        )
        if not visuals_match:
            raise ValueError(f"{scene_path}: root Visuals node not found")
        props = visuals_match.group("props")

        def read_vector(name: str, fallback: tuple[float, float]) -> list[float]:
            match = re.search(
                rf'^{re.escape(name)} = Vector2\(([^,]+),\s*([^\)]+)\)$',
                props,
                re.MULTILINE,
            )
            return [float(match.group(1)), float(match.group(2))] if match else list(fallback)

        transforms[character_id] = {
            "visualPosition": read_vector("position", (0, 0)),
            "visualScale": read_vector("scale", (1, 1)),
        }
    return transforms


def form_placements(
    scene: dict[str, Any],
    visual_transforms: dict[str, dict[str, list[float]]],
) -> dict[str, dict[str, Any]]:
    root_props = scene["nodes"][0]["props"]
    follower_path = root_props.get("_boneFollower", {}).get("v", [None])[0]
    follower = next(
        (node for node in scene["nodes"] if node_path(node) == follower_path),
        None,
    )
    follower_props = follower["props"] if follower else {}
    placements = {}
    for character_id, transform in visual_transforms.items():
        bone_property = f"_{CHARACTER_SCENES[character_id]}BoneName"
        placements[character_id] = {
            "boneName": root_props.get(bone_property) if follower else None,
            "initialPosition": vector_values(follower_props.get("position"), (0, 0)),
            "interpolationSpeed": float(follower_props.get("_interpolationSpeed", 0.5)),
            "snap": bool(follower_props.get("_snap", follower is None)),
            **transform,
        }
    return placements


def compile_scene(
    reader: PCKReader,
    spec: FormSpec,
    texture_metadata: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    scene = parse_scene(reader.read_file(spec.scene_path).decode("utf-8"), spec.scene_path)
    if spec.slug == "demon":
        flatten_packed_roots(reader, scene)
    supported_nodes = {"Node2D", "Sprite2D"}
    if spec.slug == "demon":
        supported_nodes.add("GPUParticles2D")
    kept_nodes = [node for node in scene["nodes"] if node["type"] in supported_nodes]
    kept_paths = {node_path(node) for node in kept_nodes}
    for node in kept_nodes:
        parent = node.get("parent")
        while parent not in {None, "."} and parent not in kept_paths:
            parent = parent.rsplit("/", 1)[0] if "/" in parent else "."
        node["parent"] = parent
        props = node["props"]
        if node["name"] == "center_pivot":
            props["position"] = {"$": "Vector2", "v": [0, 0]}
        if node["name"].endswith("_glow") or "glow_outer" in node["name"]:
            props["browser_pulse_strength"] = 0.04
            props["browser_pulse_speed"] = 2
        if spec.slug == "echo" and node["name"] == "vfx_echo_form_idle_glow":
            props["self_modulate"] = {"$": "Color", "v": [0, 0.61666656, 1, 0.32]}
        if "panning" in node["name"]:
            props["hframes"] = 4
            props["browser_fps"] = 4
        if node["name"] == "vfx_serpent_form_snakes":
            props["offset"] = {"$": "Vector2", "v": [-12.8, -89.6]}
            props["scale"] = {"$": "Vector2", "v": [0.9, 0.9]}
        if spec.slug == "serpent" and node["name"] == "snake_container":
            props["modulate"] = {"$": "Color", "v": [1, 1, 1, 0.45]}
        if spec.slug == "serpent" and node["name"] == "vfx_serpent_form_idle_glow":
            props["self_modulate"]["v"][3] = 0.45
        if spec.slug == "serpent" and node["name"] == "vfx_serpent_form_idle_panning_noise":
            props["self_modulate"]["v"][3] = 0.25
        if spec.slug == "reaper" and node["name"] == "vfx_reaper_form_idle_panning_noise":
            props["scale"] = {"$": "Vector2", "v": [1.75, 1.75]}

    scene["nodes"] = kept_nodes
    if spec.slug != "demon":
        scene["resources"] = {}
    prune_resources(scene)
    scene.pop("resource", None)

    for resource in scene["ext"].values():
        if resource["type"] != "Texture2D":
            continue
        source = resource["path"]
        key = spec.slug if source == NOISE else source
        metadata = texture_metadata.get(key)
        if metadata:
            resource["texture"] = metadata

    if spec.slug == "void":
        spike_texture_id = "browser_void_spike"
        scene["ext"][spike_texture_id] = {
            "path": VOID_SPIKE,
            "texture": texture_metadata[VOID_SPIKE],
            "type": "Texture2D",
        }
        for index, rotation in enumerate((-math.pi / 6, math.pi / 12, math.pi * 11 / 12, -math.pi * 5 / 6), start=1):
            pivot_name = f"browser_void_spike_{index}"
            kept_nodes.extend((
                {
                    "name": pivot_name,
                    "parent": "center_pivot",
                    "props": {"rotation": rotation, "browser_pulse_strength": 0.04, "browser_pulse_speed": 1.8},
                    "type": "Node2D",
                },
                {
                    "name": "gfx",
                    "parent": f"center_pivot/{pivot_name}",
                    "props": {
                        "position": {"$": "Vector2", "v": [110, 0]},
                        "scale": {"$": "Vector2", "v": [0.35, 0.35]},
                        "texture": {"$": "ExtResource", "v": [spike_texture_id]},
                    },
                    "type": "Sprite2D",
                },
            ))
    return scene


def main() -> int:
    args = parse_args()
    with PCKReader(args.pck) as reader:
        common_glow = save_texture(glow_texture(read_texture(reader, COMMON_GLOW)), "common_glow.webp", args.force, args.dry_run)
        noise = read_texture(reader, NOISE)
        texture_metadata = {
            COMMON_GLOW: common_glow,
            SERPENT_SNAKES: save_texture(
                lut_texture(read_texture(reader, SERPENT_SNAKES), ((0, (0, 0.303, 0.148)), (1, (0.379, 0.914, 0.605)))),
                "serpent_snakes.webp",
                args.force,
                args.dry_run,
            ),
            VOID_SPIKE: save_texture(
                lut_texture(read_texture(reader, VOID_SPIKE), ((0.438, (0.039, 0.329, 0.725)), (0.508, (0.545, 0.996, 1)), (1, (0.882, 1, 1)))),
                "void_spike.webp",
                args.force,
                args.dry_run,
            ),
        }
        for slug in ("demon", "reaper", "serpent"):
            texture_metadata[slug] = save_texture(
                animated_noise_sheet(noise, slug),
                f"{slug}_noise.webp",
                args.force,
                args.dry_run,
            )
        for source, output in DEMON_PARTICLE_TEXTURES.items():
            texture_metadata[source] = save_texture(
                read_texture(reader, source),
                output,
                args.force,
                args.dry_run,
            )

        manifest = []
        visual_transforms = character_visual_transforms(reader)
        for spec in FORMS:
            source_scene = parse_scene(
                reader.read_file(spec.scene_path).decode("utf-8"),
                spec.scene_path,
            )
            scene = compile_scene(reader, spec, texture_metadata)
            scene_path = SCENE_ROOT / f"{spec.slug}.json"
            write_json(scene_path, scene, args.dry_run)
            manifest.append({
                "cardId": spec.card_id,
                "originCharacterId": spec.origin_character_id,
                "placements": form_placements(source_scene, visual_transforms),
                "sceneUrl": public_url(scene_path),
            })
        write_json(MANIFEST_PATH, manifest, args.dry_run)

    print(f"character form vfx scenes={len(FORMS)} textures={len(texture_metadata)} dry_run={args.dry_run}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
