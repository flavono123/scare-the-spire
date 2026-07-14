#!/usr/bin/env python3
"""Extract representative STS2 encounter backgrounds and ambient scene assets.

The game assembles combat backgrounds from one randomly selected scene per
layer. The Compendium has no run seed, so this extractor chooses the canonical
`a` layer from every group and composites those layers ahead of time. Animated
scene elements that materially identify the encounter stay separate.
"""

from __future__ import annotations

import argparse
import io
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.lib.ctex import ctex_to_image, parse_import_file  # noqa: E402
from scripts.lib.pck import PCKReader, default_pck_path  # noqa: E402


OUT_ROOT = ROOT / "public/images/sts2/encounter-scenes"
MANIFEST_PATH = ROOT / "data/sts2/encounter-scene-assets.json"
EXT_RESOURCE_RE = re.compile(r"\[ext_resource[^\]]+\]")
RESOURCE_PATH_RE = re.compile(r'path="res://(?P<path>[^"]+)"')
RESOURCE_ID_RE = re.compile(r'(?:^|\s)id="(?P<id>[^"]+)"')
TEXTURE_ASSIGNMENT_RE = re.compile(r'texture\s*=\s*ExtResource\("(?P<id>[^"]+)"\)')
BACKGROUND_LAYER_RE = re.compile(r"_bg_(?P<group>\d+)_(?P<variant>[a-z])\.tscn$")
FOREGROUND_LAYER_RE = re.compile(r"_fg_(?P<variant>[a-z])\.tscn$")
NODE_HEADER_RE = re.compile(r'^\[node\s+name="(?P<name>[^"]+)"[^\]]*\]$', re.MULTILINE)
VECTOR2_RE_TEMPLATE = r"^{property}\s*=\s*Vector2\((?P<x>[-+\deE.]+),\s*(?P<y>[-+\deE.]+)\)$"
FLOAT_RE_TEMPLATE = r"^{property}\s*=\s*(?P<value>[-+\deE.]+)$"
COMBAT_COORDINATE_SIZE = {"width": 1920, "height": 1080}


@dataclass(frozen=True)
class SceneTarget:
    encounter_id: str
    title: str
    output_name: str
    monster_ids: tuple[str, ...]
    camera_scaling: float = 1.0
    camera_offset: tuple[float, float] = (0.0, 0.0)
    uses_fixed_slots: bool = False
    variant: str = "a"

    @property
    def scene_path(self) -> str:
        return f"scenes/backgrounds/{self.title}/{self.title}_background.tscn"

    @property
    def layer_prefix(self) -> str:
        return f"scenes/backgrounds/{self.title}/layers/"


TARGETS = (
    SceneTarget(
        encounter_id="SLITHERING_STRANGLER_NORMAL",
        title="overgrowth",
        output_name="overgrowth-a.webp",
        monster_ids=(
            "SNAPPING_JAXFRUIT",
            "LEAF_SLIME_M",
            "TWIG_SLIME_M",
            "LEAF_SLIME_S",
            "TWIG_SLIME_S",
            "SLITHERING_STRANGLER",
        ),
    ),
    SceneTarget(
        encounter_id="QUEEN_BOSS",
        title="queen_boss",
        output_name="queen-boss-a.webp",
        monster_ids=("TORCH_HEAD_AMALGAM", "QUEEN"),
        camera_scaling=0.9,
        camera_offset=(0.0, 60.0),
        uses_fixed_slots=True,
    ),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pck", default=default_pck_path(), help="Path to Slay the Spire 2.pck")
    parser.add_argument("--output-root", default=str(OUT_ROOT), help="Static background output directory")
    parser.add_argument("--manifest", default=str(MANIFEST_PATH), help="Scene manifest output path")
    parser.add_argument("--force", action="store_true", help="Rewrite unchanged outputs")
    parser.add_argument("--dry-run", action="store_true", help="List outputs without writing files")
    return parser.parse_args()


def choose_layer_scenes(reader: PCKReader, target: SceneTarget) -> list[str]:
    background_by_group: dict[str, str] = {}
    foregrounds: list[str] = []

    for path in sorted(reader.entries):
        if not path.startswith(target.layer_prefix) or not path.endswith(".tscn"):
            continue
        filename = Path(path).name
        if match := BACKGROUND_LAYER_RE.search(filename):
            if match.group("variant") == target.variant:
                background_by_group[match.group("group")] = path
            continue
        if match := FOREGROUND_LAYER_RE.search(filename):
            if match.group("variant") == target.variant:
                foregrounds.append(path)

    if not background_by_group:
        raise RuntimeError(f"{target.encounter_id}: no {target.variant} background layers found")
    if len(foregrounds) > 1:
        raise RuntimeError(f"{target.encounter_id}: multiple {target.variant} foreground layers found")

    layers = [background_by_group[group] for group in sorted(background_by_group)]
    return layers + foregrounds


def primary_texture_path(scene_text: str) -> str:
    textures: dict[str, str] = {}
    for resource in EXT_RESOURCE_RE.findall(scene_text):
        if 'type="Texture2D"' not in resource:
            continue
        path_match = RESOURCE_PATH_RE.search(resource)
        id_match = RESOURCE_ID_RE.search(resource)
        if path_match and id_match:
            textures[id_match.group("id")] = path_match.group("path")

    for block in re.split(r"(?=\[node )", scene_text):
        block = block.lstrip()
        if not block.startswith("[node ") or 'type="TextureRect"' not in block.splitlines()[0]:
            continue
        assignment = TEXTURE_ASSIGNMENT_RE.search(block)
        if assignment and assignment.group("id") in textures:
            return textures[assignment.group("id")]

    raise RuntimeError("layer scene has no primary TextureRect resource")


def node_block(scene_text: str, node_name: str) -> str:
    matches = list(NODE_HEADER_RE.finditer(scene_text))
    for index, match in enumerate(matches):
        if match.group("name") != node_name:
            continue
        end = matches[index + 1].start() if index + 1 < len(matches) else len(scene_text)
        return scene_text[match.start() : end]
    raise RuntimeError(f"scene has no {node_name} node")


def vector2_property(block: str, property_name: str, default: tuple[float, float]) -> dict[str, float]:
    match = re.search(
        VECTOR2_RE_TEMPLATE.format(property=re.escape(property_name)),
        block,
        re.MULTILINE,
    )
    if match is None:
        return {"x": default[0], "y": default[1]}
    return {"x": float(match.group("x")), "y": float(match.group("y"))}


def float_property(block: str, property_name: str, default: float = 0.0) -> float:
    match = re.search(
        FLOAT_RE_TEMPLATE.format(property=re.escape(property_name)),
        block,
        re.MULTILINE,
    )
    return float(match.group("value")) if match is not None else default


def creature_combat_layout(reader: PCKReader, monster_id: str) -> dict[str, object]:
    scene_path = f"scenes/creature_visuals/{monster_id.lower()}.tscn"
    scene_text = reader.read_file(scene_path).decode("utf-8", errors="replace")
    bounds_block = node_block(scene_text, "Bounds")
    visuals_block = node_block(scene_text, "Visuals")
    left = float_property(bounds_block, "offset_left")
    top = float_property(bounds_block, "offset_top")
    right = float_property(bounds_block, "offset_right")
    bottom = float_property(bounds_block, "offset_bottom")
    return {
        "monsterId": monster_id,
        "sourceScene": scene_path,
        "bounds": {
            "left": left,
            "top": top,
            "right": right,
            "bottom": bottom,
            "width": right - left,
            "height": bottom - top,
        },
        "visualPosition": vector2_property(visuals_block, "position", (0.0, 0.0)),
        "visualScale": vector2_property(visuals_block, "scale", (1.0, 1.0)),
    }


def combat_layout(reader: PCKReader, target: SceneTarget) -> dict[str, object]:
    return {
        "coordinateSize": COMBAT_COORDINATE_SIZE,
        "cameraScaling": target.camera_scaling,
        "cameraOffset": {"x": target.camera_offset[0], "y": target.camera_offset[1]},
        "usesFixedSlots": target.uses_fixed_slots,
        "enemyRegionWidth": 960,
        "enemyGap": 70,
        "enemyMinStart": 150,
        "enemyBaselineY": 740,
        "monsters": [creature_combat_layout(reader, monster_id) for monster_id in target.monster_ids],
    }


def decode_import_image(reader: PCKReader, import_path: str) -> Image.Image:
    if import_path not in reader.entries:
        raise FileNotFoundError(import_path)
    ctex_path = parse_import_file(reader.read_file(import_path))
    if not ctex_path or ctex_path not in reader.entries:
        raise FileNotFoundError(f"{import_path}: imported texture not found")
    image = ctex_to_image(reader.read_file(ctex_path))
    if image is None:
        raise RuntimeError(f"{import_path}: could not decode {ctex_path}")
    return image.convert("RGBA")


def composite_scene(reader: PCKReader, layer_paths: list[str]) -> Image.Image:
    canvas: Image.Image | None = None
    for layer_path in layer_paths:
        scene_text = reader.read_file(layer_path).decode("utf-8", errors="replace")
        texture_path = primary_texture_path(scene_text)
        layer = decode_import_image(reader, f"{texture_path}.import")
        if canvas is None:
            canvas = Image.new("RGBA", layer.size)
        elif layer.size != canvas.size:
            layer = layer.resize(canvas.size, Image.Resampling.LANCZOS)
        canvas.alpha_composite(layer)

    if canvas is None:
        raise RuntimeError("scene has no compositable layers")
    return canvas


def encode_webp(image: Image.Image) -> bytes:
    output = io.BytesIO()
    image.save(output, "WEBP", quality=92, method=6)
    return output.getvalue()


def write_if_changed(path: Path, data: bytes, *, dry_run: bool, force: bool) -> bool:
    if path.exists() and not force and path.read_bytes() == data:
        return False
    if dry_run:
        print(f"would write {path}")
        return True
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return True


def public_url(path: Path) -> str:
    return "/" + path.relative_to(ROOT / "public").as_posix()


def queen_background_spine_asset() -> dict[str, object]:
    base = "/spine/sts2/encounter-backgrounds/false_queen_cages"
    return {
        "id": "QUEEN_BOSS_CAGES",
        "source": "scenes/backgrounds/queen_boss/false_queen_cages",
        "renderStatus": "spine",
        "renderTags": ["encounter-background"],
        "atlasUrl": f"{base}/false_queen_cages.atlas",
        "binaryUrl": f"{base}/false_queen_cages.skel",
        "textureUrls": [f"{base}/false_queen_cages.png"],
        "skin": None,
        "skins": ["default"],
        "viewport": {
            "x": -1.000244140625,
            "y": -2881.00048828125,
            "width": 6146.0009765625,
            "height": 2894.234375,
            "padLeft": "0%",
            "padRight": "0%",
            "padTop": "0%",
            "padBottom": "0%",
        },
        "animations": ["animation"],
        "bestiaryAnimations": [],
        "idleAnimation": "animation",
        "moveAnimations": {},
        "moveEffects": {},
    }


def main() -> int:
    args = parse_args()
    output_root = Path(args.output_root)
    manifest_path = Path(args.manifest)
    manifest: list[dict[str, object]] = []
    written = 0

    with PCKReader(args.pck) as reader:
        for target in TARGETS:
            layer_paths = choose_layer_scenes(reader, target)
            output_path = output_root / target.output_name
            if write_if_changed(
                output_path,
                encode_webp(composite_scene(reader, layer_paths)),
                dry_run=args.dry_run,
                force=args.force,
            ):
                written += 1

            entry: dict[str, object] = {
                "id": target.encounter_id,
                "backgroundUrl": public_url(output_path),
                "sourceScene": target.scene_path,
                "sourceLayers": layer_paths,
                "ambientVfx": {"kind": "fireflies"},
                "backgroundSpineAsset": None,
                "monsterSlots": [],
                "combatLayout": combat_layout(reader, target),
            }

            if target.encounter_id == "QUEEN_BOSS":
                light_output_path = output_root / "queen-light.webp"
                light_image = decode_import_image(
                    reader,
                    "images/vfx/monsters/queen/false_queen_light.png.import",
                )
                if write_if_changed(
                    light_output_path,
                    encode_webp(light_image),
                    dry_run=args.dry_run,
                    force=args.force,
                ):
                    written += 1
                entry.update(
                    {
                        "ambientVfx": {
                            "kind": "queen",
                            "lightTextureUrl": public_url(light_output_path),
                        },
                        "backgroundSpineAsset": queen_background_spine_asset(),
                        "monsterSlots": [
                            {
                                "monsterId": "TORCH_HEAD_AMALGAM",
                                "sourcePosition": {"x": 1207, "y": 709},
                                "x": 1207 / 1920,
                                "y": 709 / 1080,
                            },
                            {
                                "monsterId": "QUEEN",
                                "sourcePosition": {"x": 1606, "y": 695},
                                "x": 1606 / 1920,
                                "y": 695 / 1080,
                            },
                        ],
                    }
                )

            manifest.append(entry)

    manifest_data = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode()
    if write_if_changed(manifest_path, manifest_data, dry_run=args.dry_run, force=args.force):
        written += 1

    print(f"encounter scenes={len(manifest)} written={written}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
