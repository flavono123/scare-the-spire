#!/usr/bin/env python3
"""Extract current STS2 Ancient scene assets and a capability manifest."""
from __future__ import annotations

import argparse
import copy
import gc
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any

from PIL import Image


REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import lib.ctex as ctex  # noqa: E402
from lib.ctex import ctex_to_image, parse_import_file  # noqa: E402
from lib.godot_scene import parse_scene  # noqa: E402
from lib.pck import PCKReader, default_pck_path  # noqa: E402


ANCIENT_IDS = ("darv", "neow", "nonupeipe", "orobas", "pael", "tanx", "tezcatara", "vakuu")
SCENE_PREFIX = "scenes/events/background_scenes"
SPINE_INDEX_PATH = REPO_ROOT / "data/sts2/ancient-spine-assets.json"
MANIFEST_PATH = REPO_ROOT / "data/sts2/ancient-scene-assets.json"
VFX_SCENE_ROOT = REPO_ROOT / "public/generated/ancient-vfx/scenes"
VFX_TEXTURE_ROOT = REPO_ROOT / "public/images/sts2/ancient-vfx/runtime"
SUPPORTED_VFX_NODES = {"AnimatedSprite2D", "CPUParticles2D", "GPUParticles2D", "Sprite2D"}
NON_VISUAL_NODES = {"Control", "Node", "Node2D", "Path2D", "PathFollow2D", "SpineBoneNode"}
STAGE_SIZE = {"width": 2560, "height": 1200}

UI_IMPORTS = {
    "dialogue_nine_patch": "images/ui/dialogue_nine_patch.png.import",
    "dialogue_tail": "images/ui/dialogue_tail.png.import",
}

def extract_texture(reader: PCKReader, import_path: str):
    raw_import = reader.read_file(import_path)
    target = parse_import_file(raw_import)
    if not target or target not in reader.entries:
        raise FileNotFoundError(f"{import_path}: texture target not found: {target}")

    image = ctex_to_image(reader.read_file(target))
    if image is None:
        raise RuntimeError(f"{import_path}: could not decode texture target: {target}")
    return image


def resource_id(value: Any, kind: str) -> str | None:
    if not isinstance(value, dict) or value.get("$") != kind:
        return None
    values = value.get("v")
    return str(values[0]) if isinstance(values, list) and values else None


def public_url(path: Path) -> str:
    return "/" + path.relative_to(REPO_ROOT / "public").as_posix()


def write_json(path: Path, value: Any) -> None:
    text = json.dumps(value, ensure_ascii=False, indent=2) + "\n"
    if not path.exists() or path.read_text() != text:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)


def scene_node_paths(scene: dict[str, Any]) -> tuple[dict[str, dict[str, Any]], dict[int, str]]:
    by_path: dict[str, dict[str, Any]] = {}
    path_by_node: dict[int, str] = {}
    for node in scene["nodes"]:
        parent = node.get("parent")
        path = "." if parent is None else node["name"] if parent == "." else f"{parent}/{node['name']}"
        by_path[path] = node
        path_by_node[id(node)] = path
    return by_path, path_by_node


def has_spine_bone_parent(node: dict[str, Any], by_path: dict[str, dict[str, Any]]) -> bool:
    parent = node.get("parent")
    while parent and parent != ".":
        ancestor = by_path.get(parent)
        if not ancestor:
            return False
        if ancestor["type"] == "SpineBoneNode":
            return True
        parent = ancestor.get("parent")
    return False


def collect_refs(value: Any, kind: str, result: set[str]) -> None:
    if isinstance(value, dict):
        ref = resource_id(value, kind)
        if ref:
            result.add(ref)
        for child in value.values():
            collect_refs(child, kind, result)
    elif isinstance(value, list):
        for child in value:
            collect_refs(child, kind, result)


def trim_runtime_scene(scene: dict[str, Any], selected: list[dict[str, Any]]) -> dict[str, Any]:
    by_path, _ = scene_node_paths(scene)
    keep_paths = {"."}
    for node in selected:
        parent = node.get("parent")
        while parent:
            keep_paths.add(parent)
            if parent == ".":
                break
            parent = by_path.get(parent, {}).get("parent")

    kept_nodes = [
        copy.deepcopy(node)
        for node in scene["nodes"]
        if node in selected or next((path for path, item in by_path.items() if item is node), None) in keep_paths
    ]
    sub_refs: set[str] = set()
    ext_refs: set[str] = set()
    collect_refs(kept_nodes, "SubResource", sub_refs)
    collect_refs(kept_nodes, "ExtResource", ext_refs)
    pending = list(sub_refs)
    while pending:
        ref = pending.pop()
        resource = scene["resources"].get(ref)
        if not resource:
            continue
        before = set(sub_refs)
        collect_refs(resource, "SubResource", sub_refs)
        collect_refs(resource, "ExtResource", ext_refs)
        pending.extend(sub_refs - before)

    return {
        "ext": {ref: copy.deepcopy(scene["ext"][ref]) for ref in sorted(ext_refs) if ref in scene["ext"]},
        "nodes": kept_nodes,
        "resources": {ref: copy.deepcopy(scene["resources"][ref]) for ref in sorted(sub_refs) if ref in scene["resources"]},
        "source": scene["source"],
        "version": scene["version"],
    }


def extract_runtime_textures(reader: PCKReader, scene: dict[str, Any], force: bool) -> None:
    for resource in scene["ext"].values():
        if resource["type"] != "Texture2D":
            continue
        source_path = resource["path"]
        out_path = (VFX_TEXTURE_ROOT / source_path).with_suffix(".webp")
        if out_path.exists() and not force:
            with Image.open(out_path) as image:
                width, height = image.size
        else:
            image = extract_texture(reader, f"{source_path}.import")
            out_path.parent.mkdir(parents=True, exist_ok=True)
            image.save(out_path, "WEBP", lossless=True, method=6)
            width, height = image.size
            image.close()
        resource["texture"] = {
            "height": height,
            "source": source_path,
            "src": public_url(out_path),
            "width": width,
        }


def vfx_descriptor(
    reader: PCKReader,
    ancient_id: str,
    scene: dict[str, Any],
    spine_node: dict[str, Any] | None,
    force: bool,
) -> tuple[dict[str, Any], list[str]]:
    by_path, path_by_node = scene_node_paths(scene)
    visual_nodes = [node for node in scene["nodes"] if node["type"] in SUPPORTED_VFX_NODES]
    bone_nodes = [node for node in visual_nodes if has_spine_bone_parent(node, by_path)]
    candidate_nodes = [node for node in visual_nodes if node not in bone_nodes and node.get("props", {}).get("visible") is not False]
    shader_nodes = []
    for node in candidate_nodes:
        material_id = resource_id(node.get("props", {}).get("material"), "SubResource")
        is_shader_sprite = (
            node["type"] in {"AnimatedSprite2D", "Sprite2D"}
            and material_id
            and scene["resources"].get(material_id, {}).get("type") == "ShaderMaterial"
        )
        if is_shader_sprite:
            shader_nodes.append(node)
    omitted_canvas_nodes = [
        node for node in candidate_nodes
        if ancient_id == "neow" and node not in shader_nodes and node["name"] != "stars"
    ]
    supported_nodes = [
        node for node in candidate_nodes
        if node not in shader_nodes and node not in omitted_canvas_nodes
    ]
    spine_index = scene["nodes"].index(spine_node) if spine_node else -1
    behind = [node for node in supported_nodes if spine_node and scene["nodes"].index(node) < spine_index]
    front = [node for node in supported_nodes if node not in behind]
    scene_urls: dict[str, str] = {}
    for slot, nodes in (("behindBody", behind), ("inFrontOfBody", front)):
        if not nodes:
            continue
        runtime_scene = trim_runtime_scene(scene, nodes)
        extract_runtime_textures(reader, runtime_scene, force)
        out_path = VFX_SCENE_ROOT / f"{ancient_id}_{slot}.json"
        write_json(out_path, runtime_scene)
        scene_urls[slot] = public_url(out_path)

    supported = Counter(node["type"] for node in supported_nodes)
    unsupported: list[dict[str, Any]] = []
    if bone_nodes:
        unsupported.append({
            "count": len(bone_nodes),
            "examples": [path_by_node[id(node)] for node in bone_nodes[:5]],
            "reason": "Spine bone attachment is not reproduced by the Canvas2D ambient runtime",
            "type": "SpineBoneNode effects",
        })
    if shader_nodes:
        unsupported.append({
            "count": len(shader_nodes),
            "examples": [path_by_node[id(node)] for node in shader_nodes[:5]],
            "reason": "Godot shader sprites are omitted because their raw textures are not valid visual fallbacks",
            "type": "ShaderMaterial",
        })
    if omitted_canvas_nodes:
        by_type = Counter(node["type"] for node in omitted_canvas_nodes)
        unsupported.append({
            "count": len(omitted_canvas_nodes),
            "examples": [path_by_node[id(node)] for node in omitted_canvas_nodes[:5]],
            "reason": "Godot additive particles become opaque between stacked canvases and obscure the Ancient body",
            "type": ", ".join(f"{key}:{value}" for key, value in sorted(by_type.items())),
        })
    gpu_nodes = [node for node in supported_nodes if node["type"] == "GPUParticles2D"]
    if gpu_nodes:
        unsupported.append({
            "count": len(gpu_nodes),
            "examples": [path_by_node[id(node)] for node in gpu_nodes[:5]],
            "reason": "Canvas2D preserves the core particle motion but not every Godot GPU material feature",
            "type": "GPUParticles2D approximation",
        })
    unsupported_visuals = [
        node for node in scene["nodes"]
        if node["type"] not in SUPPORTED_VFX_NODES | NON_VISUAL_NODES | {"SpineSprite", "TextureRect"}
    ]
    if unsupported_visuals:
        by_type = Counter(node["type"] for node in unsupported_visuals)
        unsupported.append({
            "count": len(unsupported_visuals),
            "examples": [path_by_node[id(node)] for node in unsupported_visuals[:5]],
            "reason": "Node type is not required by the bounded Ancient ambient renderer",
            "type": ", ".join(f"{key}:{value}" for key, value in sorted(by_type.items())),
        })

    support = "unsupported" if not supported_nodes else "partial" if unsupported else "full"
    return {
        "manifestPaths": scene_urls,
        "support": support,
        "supported": [f"{key}:{value}" for key, value in sorted(supported.items())],
        "unsupported": unsupported,
    }, [slot for slot in ("behindBody", "inFrontOfBody") if slot in scene_urls]


def source_texture(scene: dict[str, Any], node: dict[str, Any]) -> str | None:
    ref = resource_id(node.get("props", {}).get("texture"), "ExtResource")
    return scene["ext"].get(ref, {}).get("path") if ref else None


def vector(value: Any, fallback: tuple[float, float]) -> dict[str, float]:
    values = value.get("v") if isinstance(value, dict) and value.get("$") == "Vector2" else None
    return {
        "x": float(values[0]) if values else fallback[0],
        "y": float(values[1]) if values else fallback[1],
    }


def build_manifest_entry(
    reader: PCKReader,
    ancient_id: str,
    game_version: str,
    scene: dict[str, Any],
    spine_assets: dict[str, dict[str, Any]],
    out_root: Path,
    force: bool,
) -> dict[str, Any]:
    texture_rect = next((node for node in scene["nodes"] if node["type"] == "TextureRect"), None)
    spine_node = next((node for node in scene["nodes"] if node["type"] == "SpineSprite"), None)
    base_art = None
    if texture_rect:
        source_path = source_texture(scene, texture_rect)
        if not source_path:
            raise ValueError(f"{ancient_id}: TextureRect has no source texture")
        out_path = out_root / "ancients-bg" / f"{ancient_id}_bg.webp"
        if force or not out_path.exists():
            image = extract_texture(reader, f"{source_path}.import")
            image.convert("RGB").save(out_path, "WEBP", quality=92, method=6)
            image.close()
        base_art = {
            "path": public_url(out_path),
            "sourcePath": source_path,
            "status": "placeholder" if source_path.endswith("_placeholder.png") else "base",
        }

    spine_asset = spine_assets.get(ancient_id.upper())
    spine = None
    if spine_node:
        if not spine_asset:
            raise ValueError(f"{ancient_id}: source scene has SpineSprite but generated Spine asset is missing")
        props = spine_node["props"]
        spine = {
            "animation": spine_asset["idleAnimation"],
            "assetId": spine_asset["id"],
            "skin": spine_asset.get("skin"),
            "track": 0,
            "transform": {
                "position": vector(props.get("position"), (0, 0)),
                "scale": vector(props.get("scale"), (1, 1)),
            },
            "viewport": STAGE_SIZE,
        }

    vfx, vfx_slots = vfx_descriptor(reader, ancient_id, scene, spine_node, force)
    slots = (["baseArt"] if base_art else []) + vfx_slots
    if spine:
        body_index = slots.index("inFrontOfBody") if "inFrontOfBody" in slots else len(slots)
        slots.insert(body_index, "body")
    fallback_name = f"{ancient_id}_fallback.webp" if spine else f"{ancient_id}_bg.webp"
    return {
        "alternatives": [],
        "baseArt": base_art,
        "composition": {
            "slots": slots,
            "sourceZOrder": slots,
        },
        "fallback": {"path": f"/images/sts2/ancients-bg/{fallback_name}"},
        "id": ancient_id.upper(),
        "source": {
            "gameVersion": game_version,
            "scenePath": scene["source"],
        },
        "spine": spine,
        "token": f"/images/sts2/ancients/{ancient_id}.webp",
        "vfx": vfx,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pck", default=default_pck_path(), help="Path to Slay the Spire 2.pck")
    parser.add_argument("--out-root", default="public/images/sts2", help="Image output root under the repo")
    parser.add_argument("--force", action="store_true", help="Overwrite existing extracted files")
    parser.add_argument("--id", choices=ANCIENT_IDS, help="Force-refresh only one Ancient while rebuilding the full manifest")
    args = parser.parse_args()

    if ctex.Image is None:
        raise RuntimeError("Pillow is required to decode Godot .ctex textures. Install with: python3 -m pip install Pillow")

    out_root = (REPO_ROOT / args.out_root).resolve()
    ancient_dir = out_root / "ancients"
    background_dir = out_root / "ancients-bg"
    dialogue_dir = out_root / "ancient-dialogue"
    ancient_dir.mkdir(parents=True, exist_ok=True)
    background_dir.mkdir(parents=True, exist_ok=True)
    dialogue_dir.mkdir(parents=True, exist_ok=True)

    pck_path = Path(args.pck).expanduser()
    release_info_path = pck_path.with_name("release_info.json")
    release_info = json.loads(release_info_path.read_text())
    spine_assets = {item["id"]: item for item in json.loads(SPINE_INDEX_PATH.read_text())}
    manifest: list[dict[str, Any]] = []

    with PCKReader(pck_path) as reader:
        for ancient_id in ANCIENT_IDS:
            out_path = ancient_dir / f"{ancient_id}.webp"
            force_ancient = args.force and (args.id is None or args.id == ancient_id)
            if out_path.exists() and not force_ancient:
                continue
            image = extract_texture(reader, f"images/ui/run_history/{ancient_id}.png.import")
            image.save(out_path, "WEBP", lossless=True, method=6)
            image.close()
            print(f"extracted Ancient token: {out_path.relative_to(REPO_ROOT)}")

        for name, import_path in UI_IMPORTS.items():
            out_path = dialogue_dir / f"{name}.webp"
            if (args.force and args.id is None) or not out_path.exists():
                image = extract_texture(reader, import_path)
                image.save(out_path, "WEBP", lossless=True, method=6)
                image.close()
                print(f"extracted Ancient dialogue UI: {out_path.relative_to(REPO_ROOT)}")

        for ancient_id in ANCIENT_IDS:
            scene_path = f"{SCENE_PREFIX}/{ancient_id}.tscn"
            scene = parse_scene(reader.read_file(scene_path).decode("utf-8"), scene_path)
            manifest.append(build_manifest_entry(
                reader,
                ancient_id,
                release_info["version"],
                scene,
                spine_assets,
                out_root,
                args.force and (args.id is None or args.id == ancient_id),
            ))
            gc.collect()
            print(f"compiled Ancient scene: {ancient_id}")

    if [item["id"] for item in manifest] != [item.upper() for item in ANCIENT_IDS]:
        raise ValueError("Ancient manifest IDs are incomplete or out of order")
    write_json(MANIFEST_PATH, manifest)
    print(f"wrote Ancient scene manifest: {MANIFEST_PATH.relative_to(REPO_ROOT)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
