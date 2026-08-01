#!/usr/bin/env python3
"""Compile STS2 event VFX scenes and textures into browser-only static assets.

The source of truth is the local game PCK. Godot scene values are parsed at
authoring time so neither Next.js nor the Cloudflare Worker performs PCK work,
JSON joins, or texture decoding at request time.

Run with the optional texture dependencies:
  uv run --with pillow --with texture2ddecoder python scripts/extract-event-vfx-scenes.py
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.lib.ctex import ctex_to_image, parse_import_file
from scripts.lib.godot_scene import parse_scene
from scripts.lib.pck import PCKReader, default_pck_path


SCENE_PREFIX = "scenes/vfx/events/"
MIRROR_SCENE = "scenes/vfx/whole_screen/mirror_vfx.tscn"
OUT_ROOT = ROOT / "public/images/sts2/event-vfx/runtime"
SCENE_OUT_ROOT = ROOT / "public/generated/event-vfx/scenes"
INDEX_PATH = ROOT / "data/sts2/event-vfx-scenes.json"

SCENE_RE = re.compile(r"^scenes/vfx/events/(?P<slug>.+)_vfx\.tscn$")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pck", default=default_pck_path(), help="Path to Slay the Spire 2.pck")
    parser.add_argument("--force", action="store_true", help="Rewrite unchanged textures")
    parser.add_argument("--dry-run", action="store_true", help="Validate and report without writing")
    return parser.parse_args()


def texture_output_path(source_path: str) -> Path:
    return (OUT_ROOT / Path(source_path)).with_suffix(".webp")


def public_url(path: Path) -> str:
    return "/" + path.relative_to(ROOT / "public").as_posix()


def extract_texture(reader: PCKReader, source_path: str, force: bool, dry_run: bool) -> dict[str, Any]:
    import_path = f"{source_path}.import"
    if import_path not in reader.entries:
        raise FileNotFoundError(f"missing texture import: {import_path}")
    ctex_path = parse_import_file(reader.read_file(import_path))
    if not ctex_path or ctex_path not in reader.entries:
        raise FileNotFoundError(f"missing ctex for {source_path}: {ctex_path}")
    image = ctex_to_image(reader.read_file(ctex_path))
    if image is None:
        raise ValueError(
            f"cannot decode {source_path}; run with Pillow and texture2ddecoder installed"
        )
    output_path = texture_output_path(source_path)
    if not dry_run and (force or not output_path.exists()):
        output_path.parent.mkdir(parents=True, exist_ok=True)
        image.save(output_path, "WEBP", lossless=True, method=6)
    return {
        "height": image.height,
        "source": source_path,
        "src": public_url(output_path),
        "width": image.width,
    }


def ref_id(value: Any, kind: str) -> str | None:
    if not isinstance(value, dict) or value.get("$") != kind:
        return None
    values = value.get("v")
    return str(values[0]) if isinstance(values, list) and values else None


def attach_texture_metadata(scene: dict[str, Any], textures: dict[str, dict[str, Any]]) -> None:
    for resource_id, resource in scene["ext"].items():
        if resource["type"] != "Texture2D":
            continue
        source_path = resource["path"]
        resource["texture"] = textures[source_path]

    for resource in scene["resources"].values():
        props = resource["props"]
        if resource["type"] == "CanvasItemMaterial":
            props.setdefault("blend_mode", 0)


def write_json(path: Path, value: Any, dry_run: bool) -> None:
    text = json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n"
    if dry_run:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists() or path.read_text() != text:
        path.write_text(text)


def main() -> int:
    args = parse_args()
    scene_outputs: dict[str, dict[str, Any]] = {}
    texture_cache: dict[str, dict[str, Any]] = {}

    with PCKReader(args.pck) as reader:
        scene_paths = sorted(
            path for path in reader.entries if SCENE_RE.match(path)
        )
        scene_paths.append(MIRROR_SCENE)

        for scene_path in scene_paths:
            slug = "mirror" if scene_path == MIRROR_SCENE else SCENE_RE.match(scene_path).group("slug")  # type: ignore[union-attr]
            scene = parse_scene(reader.read_file(scene_path).decode("utf-8"), scene_path)
            for ext_resource in scene["ext"].values():
                if ext_resource["type"] != "Texture2D":
                    continue
                source_path = ext_resource["path"]
                if source_path not in texture_cache:
                    texture_cache[source_path] = extract_texture(
                        reader, source_path, args.force, args.dry_run
                    )
            attach_texture_metadata(scene, texture_cache)
            output_path = SCENE_OUT_ROOT / f"{slug}.json"
            write_json(output_path, scene, args.dry_run)
            scene_outputs[slug] = {
                "nodes": len(scene["nodes"]),
                "src": public_url(output_path),
                "textures": sum(1 for item in scene["ext"].values() if item["type"] == "Texture2D"),
            }

    initial_scenes = {
        slug.upper(): slug
        for slug in scene_outputs
        if slug not in {
            "dense_vegetation_slice",
            "mirror",
            "trial_merchant",
            "trial_noble",
            "trial_nondescript",
        }
    }
    index = {
        "initialScenes": initial_scenes,
        "oneShots": {"DENSE_VEGETATION": {"TRUDGE_ON": "dense_vegetation_slice"}},
        "scenes": scene_outputs,
        "specialScenes": {"REFLECTIONS": "mirror"},
        "trialScenes": {
            "MERCHANT": "trial_merchant",
            "NOBLE": "trial_noble",
            "NONDESCRIPT": "trial_nondescript",
        },
        "version": 1,
    }
    write_json(INDEX_PATH, index, args.dry_run)
    total_bytes = sum(path.stat().st_size for path in OUT_ROOT.rglob("*.webp")) if OUT_ROOT.exists() else 0
    print(
        f"event vfx scenes={len(scene_outputs)} textures={len(texture_cache)} "
        f"texture_bytes={total_bytes} dry_run={args.dry_run}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
