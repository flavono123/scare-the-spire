#!/usr/bin/env python3
"""Extract STS2 monster Phobia Mode body textures from the local PCK."""
from __future__ import annotations

import argparse
import json
import math
import re
import sys
from pathlib import Path
from typing import Iterable

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.lib.ctex import ctex_to_image, parse_import_file  # noqa: E402
from scripts.lib.pck import PCKReader, default_pck_path  # noqa: E402

PHOBIA_OUTPUT_DIR = ROOT / "public/images/sts2/monsters-phobia"
PHOBIA_DATA_PATH = ROOT / "data/sts2/monster-phobia-assets.json"
MAX_OUTPUT_DIMENSION = 1400
EXT_RESOURCE_RE = re.compile(r'^\[ext_resource type="(?P<type>[^"]+)".* path="res://(?P<path>[^"]+)" id="(?P<id>[^"]+)"\]')
SUB_RESOURCE_RE = re.compile(r'^\[sub_resource type="(?P<type>[^"]+)" id="(?P<id>[^"]+)"\]')
NODE_RE = re.compile(r'^\[node name="(?P<name>[^"]+)" type="(?P<type>[^"]+)"(?: parent="(?P<parent>[^"]*)")?.*\]')
PROP_RE = re.compile(r'^(?P<key>[A-Za-z0-9_./]+) = (?P<value>.+)$')
VECTOR2_RE = re.compile(r"^Vector2\((?P<x>[-+0-9.eE]+), (?P<y>[-+0-9.eE]+)\)$")
EXT_VALUE_RE = re.compile(r'^ExtResource\("(?P<id>[^"]+)"\)$')
SUB_VALUE_RE = re.compile(r'^SubResource\("(?P<id>[^"]+)"\)$')

DIRECT_ASSETS = [
    {
        "id": "ENTOMANCER",
        "source": "images/monsters/phobia_mode/phobia_entomancer.png.import",
        "fileName": "entomancer.webp",
        "scenePath": "scenes/creature_visuals/entomancer.tscn",
    },
    {
        "id": "PHROG_PARASITE",
        "source": "images/monsters/phobia_mode/phrog_parasite_phobia.png.import",
        "fileName": "phrog_parasite.webp",
        "scenePath": "scenes/creature_visuals/phrog_parasite.tscn",
    },
    {
        "id": "TERROR_EEL",
        "source": "images/monsters/phobia_mode/terror_eel_phobia.png.import",
        "fileName": "terror_eel.webp",
        "scenePath": "scenes/creature_visuals/terror_eel.tscn",
    },
    {
        "id": "THE_INSATIABLE",
        "source": "images/monsters/phobia_mode/the_insatiable_phobia.png.import",
        "fileName": "the_insatiable.webp",
        "scenePath": "scenes/creature_visuals/the_insatiable.tscn",
    },
    {
        "id": "WRIGGLER",
        "source": "images/monsters/phobia_mode/wriggler_phobia.png.import",
        "fileName": "wriggler.webp",
        "scenePath": "scenes/creature_visuals/wriggler.tscn",
    },
]

DECIMILLIPEDE_PARTS = [
    {
        "id": "back",
        "source": "images/monsters/phobia_mode/decimillipede_segment_back_phobia.png.import",
        "fileName": "decimillipede_back.webp",
        "scenePath": "scenes/creature_visuals/decimillipede_segment_back.tscn",
        "offset": (0, 86),
    },
    {
        "id": "middle",
        "source": "images/monsters/phobia_mode/decimillipede_segment_middle_phobia.png.import",
        "fileName": "decimillipede_middle.webp",
        "scenePath": "scenes/creature_visuals/decimillipede_segment_middle.tscn",
        "offset": (390, 84),
    },
    {
        "id": "front",
        "source": "images/monsters/phobia_mode/decimillipede_segment_front_phobia.png.import",
        "fileName": "decimillipede_front.webp",
        "scenePath": "scenes/creature_visuals/decimillipede_segment_front.tscn",
        "offset": (745, 0),
    },
]


def load_imported_image(reader: PCKReader, import_path: str):
    raw_import = reader.read_file(import_path)
    ctex_path = parse_import_file(raw_import)
    if not ctex_path:
        raise RuntimeError(f"No ctex path found in {import_path}")
    image = ctex_to_image(reader.read_file(ctex_path))
    if image is None:
        raise RuntimeError(f"Could not decode {ctex_path}")
    return image, ctex_path


def save_webp(image, out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(out_path, "WEBP", lossless=True, quality=95, method=6)


def fit_for_web(image):
    if max(image.width, image.height) <= MAX_OUTPUT_DIMENSION:
        return image
    resized = image.copy()
    resized.thumbnail((MAX_OUTPUT_DIMENSION, MAX_OUTPUT_DIMENSION), Image.Resampling.LANCZOS)
    return resized


def parse_value(value: str):
    vector = VECTOR2_RE.match(value)
    if vector:
        return {"x": float(vector.group("x")), "y": float(vector.group("y"))}
    ext = EXT_VALUE_RE.match(value)
    if ext:
        return {"extResource": ext.group("id")}
    sub = SUB_VALUE_RE.match(value)
    if sub:
        return {"subResource": sub.group("id")}
    if value == "true":
        return True
    if value == "false":
        return False
    try:
        number = float(value)
    except ValueError:
        return value.strip('"')
    return int(number) if math.isfinite(number) and number.is_integer() else number


def parse_scene(raw: str) -> tuple[dict[str, dict[str, str]], dict[str, dict[str, object]], list[dict[str, object]]]:
    ext_resources: dict[str, dict[str, str]] = {}
    sub_resources: dict[str, dict[str, object]] = {}
    nodes: list[dict[str, object]] = []
    current: dict[str, object] | None = None

    for line in raw.splitlines():
        ext_match = EXT_RESOURCE_RE.match(line)
        if ext_match:
            ext_resources[ext_match.group("id")] = {
                "type": ext_match.group("type"),
                "path": ext_match.group("path"),
            }
            current = None
            continue
        sub_match = SUB_RESOURCE_RE.match(line)
        if sub_match:
            current = {
                "kind": "sub",
                "id": sub_match.group("id"),
                "type": sub_match.group("type"),
                "props": {},
            }
            sub_resources[sub_match.group("id")] = current
            continue
        node_match = NODE_RE.match(line)
        if node_match:
            current = {
                "kind": "node",
                "name": node_match.group("name"),
                "type": node_match.group("type"),
                "parent": node_match.group("parent") or "",
                "props": {},
            }
            nodes.append(current)
            continue
        prop_match = PROP_RE.match(line)
        if prop_match and current is not None:
            props = current["props"]
            assert isinstance(props, dict)
            props[prop_match.group("key")] = parse_value(prop_match.group("value"))

    return ext_resources, sub_resources, nodes


def vector_prop(props: dict[str, object], key: str, fallback: tuple[float, float]) -> dict[str, float]:
    value = props.get(key)
    if isinstance(value, dict) and "x" in value and "y" in value:
        return {"x": float(value["x"]), "y": float(value["y"])}
    return {"x": fallback[0], "y": fallback[1]}


def number_prop(props: dict[str, object], key: str, fallback: float) -> float:
    value = props.get(key)
    return float(value) if isinstance(value, (int, float)) else fallback


def resource_id(value: object) -> str | None:
    if isinstance(value, dict):
        ext = value.get("extResource")
        sub = value.get("subResource")
        if isinstance(ext, str):
            return ext
        if isinstance(sub, str):
            return sub
    return None


def extract_effect_texture(reader: PCKReader, texture_path: str) -> dict[str, object]:
    source = texture_path.removeprefix("res://")
    image, ctex_path = load_imported_image(reader, f"{source}.import")
    output_image = fit_for_web(image)
    texture_slug = Path(source).stem
    out_path = PHOBIA_OUTPUT_DIR / "effects" / f"{texture_slug}.webp"
    save_webp(output_image, out_path)
    return {
        "imageUrl": f"/images/sts2/monsters-phobia/effects/{texture_slug}.webp",
        "source": f"{source}.import",
        "ctex": ctex_path,
        "width": output_image.width,
        "height": output_image.height,
    }


def extract_phobia_scene(reader: PCKReader, scene_path: str, image_width: int, image_height: int) -> dict[str, object] | None:
    raw = reader.read_file(scene_path).decode("utf-8", errors="replace")
    ext_resources, sub_resources, nodes = parse_scene(raw)
    phobia_node = next((node for node in nodes if node["name"] == "PhobiaModeVisuals"), None)
    if phobia_node is None:
        return None
    props = phobia_node["props"]
    assert isinstance(props, dict)
    position = vector_prop(props, "position", (0, 0))
    scale = vector_prop(props, "scale", (1, 1))
    bounds_node = next((node for node in nodes if node["name"] == "Bounds"), None)
    bounds_props = bounds_node["props"] if bounds_node is not None else {}
    assert isinstance(bounds_props, dict)

    sprite_width = image_width * abs(scale["x"])
    sprite_height = image_height * abs(scale["y"])
    sprite_left = position["x"] - sprite_width / 2
    sprite_top = position["y"] - sprite_height / 2
    left = min(number_prop(bounds_props, "offset_left", sprite_left), sprite_left)
    top = min(number_prop(bounds_props, "offset_top", sprite_top), sprite_top)
    right = max(number_prop(bounds_props, "offset_right", position["x"] + sprite_width / 2), position["x"] + sprite_width / 2)
    bottom = max(number_prop(bounds_props, "offset_bottom", 0), position["y"] + sprite_height / 2)

    particles: list[dict[str, object]] = []
    for node in nodes:
        if node["parent"] != "PhobiaModeVisuals" or node["type"] not in {"GPUParticles2D", "CPUParticles2D"}:
            continue
        particle_props = node["props"]
        assert isinstance(particle_props, dict)
        texture_id = resource_id(particle_props.get("texture"))
        texture_resource = ext_resources.get(texture_id) if texture_id else None
        if texture_resource is None:
            continue
        texture = extract_effect_texture(reader, texture_resource["path"])
        material_id = resource_id(particle_props.get("process_material"))
        material = sub_resources.get(material_id) if material_id else None
        material_props = material["props"] if material is not None else {}
        assert isinstance(material_props, dict)
        particle_position = vector_prop(particle_props, "position", (0, 0))
        ring_radius = number_prop(material_props, "emission_ring_radius", 0) * abs(scale["x"])
        particle_center_x = position["x"] + particle_position["x"] * scale["x"]
        particle_center_y = position["y"] + particle_position["y"] * scale["y"]
        left = min(left, particle_center_x - ring_radius)
        top = min(top, particle_center_y - ring_radius)
        right = max(right, particle_center_x + ring_radius)
        bottom = max(bottom, particle_center_y + ring_radius)
        particles.append({
            "name": node["name"],
            "type": node["type"],
            "position": particle_position,
            "amount": int(number_prop(particle_props, "amount", 32)),
            "lifetime": number_prop(particle_props, "lifetime", 1),
            "preprocess": number_prop(particle_props, "preprocess", 0),
            "localCoords": bool(particle_props.get("local_coords", False)),
            "texture": texture,
            "material": {
                "emissionRingRadius": number_prop(material_props, "emission_ring_radius", 0),
                "emissionRingInnerRadius": number_prop(material_props, "emission_ring_inner_radius", 0),
                "initialVelocityMin": number_prop(material_props, "initial_velocity_min", 0),
                "initialVelocityMax": number_prop(material_props, "initial_velocity_max", 0),
                "orbitVelocityMin": number_prop(material_props, "orbit_velocity_min", 0),
                "orbitVelocityMax": number_prop(material_props, "orbit_velocity_max", 0),
                "scaleMin": number_prop(material_props, "scale_min", 1),
                "scaleMax": number_prop(material_props, "scale_max", 1),
                "spread": number_prop(material_props, "spread", 0),
            },
        })

    padding = 16
    return {
        "scenePath": scene_path,
        "viewBox": {
            "x": left - padding,
            "y": top - padding,
            "width": right - left + padding * 2,
            "height": bottom - top + padding * 2,
        },
        "sprite": {
            "position": position,
            "scale": scale,
            "width": image_width,
            "height": image_height,
        },
        "particles": particles,
    }


def extract_direct_assets(reader: PCKReader) -> list[dict[str, object]]:
    records: list[dict[str, object]] = []
    for asset in DIRECT_ASSETS:
        image, ctex_path = load_imported_image(reader, asset["source"])
        output_image = fit_for_web(image)
        out_path = PHOBIA_OUTPUT_DIR / asset["fileName"]
        save_webp(output_image, out_path)
        records.append({
            "id": asset["id"],
            "imageUrl": f"/images/sts2/monsters-phobia/{asset['fileName']}",
            "source": asset["source"],
            "ctex": ctex_path,
            "width": output_image.width,
            "height": output_image.height,
            "scene": extract_phobia_scene(reader, asset["scenePath"], output_image.width, output_image.height),
        })
    return records


def extract_decimillipede(reader: PCKReader) -> dict[str, object]:
    loaded_parts = []
    for part in DECIMILLIPEDE_PARTS:
        image, ctex_path = load_imported_image(reader, part["source"])
        loaded_parts.append((part, image, ctex_path))

    width = max(part["offset"][0] + image.width for part, image, _ in loaded_parts)
    height = max(part["offset"][1] + image.height for part, image, _ in loaded_parts)
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    for part, image, _ in loaded_parts:
        canvas.alpha_composite(image, dest=part["offset"])

    output_image = fit_for_web(canvas)
    out_path = PHOBIA_OUTPUT_DIR / "decimillipede.webp"
    save_webp(output_image, out_path)
    part_image_urls: dict[str, str] = {}
    part_scenes: dict[str, object] = {}
    for part, image, _ in loaded_parts:
        part_output = fit_for_web(image)
        part_out_path = PHOBIA_OUTPUT_DIR / part["fileName"]
        save_webp(part_output, part_out_path)
        part_image_urls[part["id"]] = f"/images/sts2/monsters-phobia/{part['fileName']}"
        part_scene = extract_phobia_scene(reader, part["scenePath"], part_output.width, part_output.height)
        if part_scene:
            part_scenes[part["id"]] = part_scene
    return {
        "id": "DECIMILLIPEDE_SEGMENT",
        "imageUrl": "/images/sts2/monsters-phobia/decimillipede.webp",
        "partImageUrls": part_image_urls,
        "partScenes": part_scenes,
        "source": [part["source"] for part, _, _ in loaded_parts],
        "ctex": [ctex_path for _, _, ctex_path in loaded_parts],
        "width": output_image.width,
        "height": output_image.height,
    }


def write_json(path: Path, records: Iterable[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(list(records), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pck", default=default_pck_path(), help="Path to Slay the Spire 2.pck")
    args = parser.parse_args()

    with PCKReader(args.pck) as reader:
        records = [extract_decimillipede(reader), *extract_direct_assets(reader)]

    write_json(PHOBIA_DATA_PATH, records)
    print(f"Wrote {len(records)} phobia-mode monster assets to {PHOBIA_DATA_PATH}")


if __name__ == "__main__":
    main()
