#!/usr/bin/env python3
"""Extract combat UI pieces for the dev combat simulator from a STS2 PCK.

- Energy counters: `scenes/combat/energy_counters/<character>_energy_counter.tscn`.
  Each TextureRect under `Layers` is exported in draw order; children of
  `Layers/RotationLayers` are marked with their rotation index (NEnergyCounter
  turns child i at (i + 1) * 30 deg/s, 5 deg/s at 0 energy). The Label's colors
  and sizes are copied into the manifest.
- Pile buttons, the block icon and the health bar textures (health_bar.tscn).
- Card trail VFX per character (`scenes/vfx/card_trail_<character>.tscn`, drawn
  behind NCardFlyVfx): both Line2D trails, the silhouette sprites and the two
  particle systems, with their textures.
- Energy gain VFX per character (`scenes/vfx/energy/<character>/*_energy_vfx_{back,front}.tscn`,
  restarted by NEnergyCounter.OnEnergyChanged when energy goes up): the glow and
  polar ring particles with their curves; other particle nodes are listed as not
  exported.
- Power icons that the site data does not ship (e.g. GRASP_POWER, removed with
  Doormaker in v0.105.0): `images/powers/<name>.png`.

Writes public/images/sts2/combat-ui/** and data/sts2/combat-ui-assets.json.

  python3 scripts/extract-combat-ui-assets.py --archive-version 0.102.0
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.lib.ctex import ctex_to_image, parse_import_file
from scripts.lib.pck import PCKReader, default_pck_path

OUT_ROOT = ROOT / "public/images/sts2/combat-ui"
MANIFEST = ROOT / "data/sts2/combat-ui-assets.json"
CHARACTERS = ["ironclad", "silent", "defect", "regent", "necrobinder"]
POWER_ICONS = ["grasp_power"]
# Textures used by scenes/combat/{draw,discard,exhaust}_pile.tscn and health_bar.tscn.
UI_TEXTURES = [
    "images/packed/combat_ui/draw_pile.png",
    "images/packed/combat_ui/discard_pile.png",
    "images/packed/combat_ui/exhaust_pile.png",
    "images/packed/combat_ui/pile_button_count.png",
    "images/ui/combat/block.png",
    "images/ui/combat/health_bar_bg.png",
    "images/ui/combat/health_bar_stroke.png",
    "images/ui/combat/health_bar.png",
    "images/ui/combat/health_bar_fill.png",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--pck", help="Path to Slay the Spire 2.pck (default: the Steam install)")
    parser.add_argument("--archive-version", help="Read ~/sts2-builds/<version>/.../Slay the Spire 2.pck instead")
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def pck_path(args: argparse.Namespace) -> str:
    if args.pck:
        return args.pck
    if args.archive_version:
        return str(Path.home() / "sts2-builds" / args.archive_version / "SlayTheSpire2.app/Contents/Resources/Slay the Spire 2.pck")
    return default_pck_path()


def godot_color(value: str) -> str:
    """`Color(1, 0.96, 0.88, 1)` -> `#fff6e2ff`."""
    parts = [float(part) for part in re.findall(r"-?[0-9.]+", value)]
    return "#" + "".join(f"{max(0, min(255, round(part * 255))):02x}" for part in parts[:4])


def parse_tscn(text: str) -> tuple[dict[str, str], list[dict]]:
    resources: dict[str, str] = {}
    nodes: list[dict] = []
    current: dict | None = None
    for line in text.splitlines():
        ext = re.match(r'\[ext_resource type="Texture2D".*path="res://([^"]+)" id="([^"]+)"\]', line)
        if ext:
            resources[ext.group(2)] = ext.group(1)
            continue
        node = re.match(r'\[node name="([^"]+)" type="([^"]+)"(?: parent="([^"]*)")?', line)
        if node:
            current = {"name": node.group(1), "type": node.group(2), "parent": node.group(3), "props": {}}
            nodes.append(current)
            continue
        if line.startswith("["):
            current = None
            continue
        prop = re.match(r"([\w/]+) = (.+)", line)
        if current is not None and prop:
            current["props"][prop.group(1)] = prop.group(2)
    return resources, nodes


def parse_value(raw: str, subresources: dict[str, dict], externals: dict[str, str]):
    """Godot text resource values: numbers, Color, Vector2, packed arrays, curve data, Sub/ExtResource refs."""
    raw = raw.strip()
    if raw in ("true", "false"):
        return raw == "true"
    if re.fullmatch(r"-?[0-9.e+-]+", raw):
        return float(raw)
    if raw.startswith('"'):
        return raw.strip('"')
    ref = re.fullmatch(r'(Sub|Ext)Resource\("([^"]+)"\)', raw)
    if ref:
        return subresources.get(ref.group(2)) if ref.group(1) == "Sub" else externals.get(ref.group(2))
    if "NodePath(" in raw:
        return re.findall(r'NodePath\("([^"]+)"\)', raw)
    inner = raw[raw.index("(") + 1:raw.rindex(")")] if "(" in raw and not raw.startswith("[") else raw
    numbers = [float(value) for value in re.findall(r"-?[0-9.]+(?:e[-+]?[0-9]+)?", inner)]
    if raw.startswith(("Color(", "Vector2(", "Vector3(")):
        return numbers
    if raw.startswith("PackedFloat32Array("):
        return numbers
    if raw.startswith("PackedColorArray("):
        return [numbers[i:i + 4] for i in range(0, len(numbers), 4)]
    if raw.startswith("[") and "Vector2(" in raw:
        # Curve _data: Vector2(x, y), left_tangent, right_tangent, left_mode, right_mode, ...
        tokens = re.findall(r"Vector2\(([^)]*)\)|(-?[0-9.]+(?:e[-+]?[0-9]+)?)", raw)
        values: list = []
        for vector, number in tokens:
            values.append([float(v) for v in vector.split(",")] if vector else float(number))
        return [
            {"x": values[i][0], "y": values[i][1], "leftTangent": values[i + 1], "rightTangent": values[i + 2]}
            for i in range(0, len(values), 5)
        ]
    if raw.startswith("["):
        return numbers
    return raw


def parse_resource(text: str, externals_by_type: bool = False) -> dict:
    """Sections of a .tscn/.tres: sub_resources by id, nodes in order, the [resource] body."""
    externals: dict[str, str] = {}
    subresources: dict[str, dict] = {}
    nodes: list[dict] = []
    resource: dict = {}
    current: dict | None = None
    pending: list[tuple[dict, str, str]] = []
    for line in text.splitlines():
        ext = re.match(r'\[ext_resource type="([^"]+)".*path="res://([^"]+)" id="([^"]+)"\]', line)
        if ext:
            externals[ext.group(3)] = ext.group(2)
            continue
        sub = re.match(r'\[sub_resource type="([^"]+)" id="([^"]+)"\]', line)
        if sub:
            current = {"type": sub.group(1)}
            subresources[sub.group(2)] = current
            continue
        node = re.match(r'\[node name="([^"]+)"(?: type="([^"]+)")?(?: parent="([^"]*)")?(?: instance=ExtResource\("([^"]+)"\))?', line)
        if node:
            current = {"name": node.group(1), "type": node.group(2), "parent": node.group(3), "instance": node.group(4)}
            nodes.append(current)
            continue
        if line.startswith("[resource]"):
            current = resource
            continue
        if line.startswith("["):
            current = None
            continue
        prop = re.match(r"([\w/]+) = (.+)", line)
        if current is not None and prop:
            pending.append((current, prop.group(1), prop.group(2)))
    # Sub-resources may reference later ones, so resolve after reading everything.
    for target, key, raw in pending:
        target[key] = raw
    for _ in range(3):
        for target, key, raw in pending:
            target[key] = parse_value(raw, subresources, externals)
    for node in nodes:
        if node.get("instance"):
            node["instance"] = externals.get(node["instance"])
    return {"externals": externals, "subresources": subresources, "nodes": nodes, "resource": resource}


def curve_of(texture_resource) -> list | None:
    """CurveTexture / CurveXYZTexture -> points (x curve for XYZ)."""
    if not isinstance(texture_resource, dict):
        return None
    curve = texture_resource.get("curve") or texture_resource.get("curve_x")
    return curve.get("_data") if isinstance(curve, dict) else None


def gradient_of(resource) -> dict | None:
    if not isinstance(resource, dict):
        return None
    gradient = resource.get("gradient", resource)
    if not isinstance(gradient, dict) or "colors" not in gradient:
        return None
    colors = gradient["colors"]
    return {"offsets": gradient.get("offsets") or [i / max(1, len(colors) - 1) for i in range(len(colors))], "colors": colors}


def export_texture(reader: PCKReader, source: str, out: Path, dry_run: bool) -> None:
    ctex = parse_import_file(reader.read_file(f"{source}.import"))
    if not ctex or ctex not in reader.entries:
        raise FileNotFoundError(f"missing ctex for {source}")
    image = ctex_to_image(reader.read_file(ctex))
    if image is None:
        raise ValueError(f"unsupported texture: {ctex}")
    print(f"{source} -> {out.relative_to(ROOT)} ({image.width}x{image.height})")
    if dry_run:
        return
    out.parent.mkdir(parents=True, exist_ok=True)
    image.save(out, "WEBP", lossless=True)


def url_of(path: Path) -> str:
    return "/" + str(path.relative_to(ROOT / "public"))


def texture_url(reader: PCKReader, source: str | None, dry_run: bool, cache: dict[str, str]) -> str | None:
    if not source:
        return None
    if source not in cache:
        out = OUT_ROOT / "vfx" / f"{Path(source).stem}.webp"
        export_texture(reader, source, out, dry_run)
        cache[source] = url_of(out)
    return cache[source]


def read_resource(reader: PCKReader, path: str) -> dict:
    return parse_resource(reader.read_file(path).decode("utf-8"))


def particle_params(node: dict, base: dict | None) -> dict:
    """GPU/CPUParticles2D node props, falling back to the instanced scene's root node."""
    merged = {**(base or {}), **{key: value for key, value in node.items() if value is not None}}
    material = merged.get("process_material") if isinstance(merged.get("process_material"), dict) else {}
    return {
        "amount": merged.get("amount", 8.0),
        "lifetime": merged.get("lifetime", 1.0),
        "modulate": merged.get("self_modulate", [1, 1, 1, 1]),
        "scaleMin": material.get("scale_min", merged.get("scale_amount_min", 1.0)),
        "scaleMax": material.get("scale_max", merged.get("scale_amount_max", 1.0)),
        "scaleCurve": curve_of(material.get("scale_curve")),
        "alphaCurve": curve_of(material.get("alpha_curve")),
        "emissionCurve": curve_of(material.get("emission_curve")),
    }


def energy_gain_vfx(reader: PCKReader, character: str, dry_run: bool, cache: dict[str, str]) -> dict:
    result: dict = {"layers": [], "notExported": []}
    for side in ("back", "front"):
        path = f"scenes/vfx/energy/{character}/{character}_energy_vfx_{side}.tscn"
        if path not in reader.entries:
            continue
        scene = read_resource(reader, path)
        restarted = {str(name).split("/")[-1] for name in (scene["nodes"][0].get("_particles") or [])} if scene["nodes"] else set()
        for node in scene["nodes"][1:]:
            if node["name"] not in restarted:
                continue
            instance = node.get("instance") or ""
            kind = "glow" if "vfx_common_glow" in instance else "ring" if "vfx_common_ring_polar" in instance else None
            if not kind:
                result["notExported"].append(f"{side}:{node['name']}")
                continue
            base_scene = read_resource(reader, instance)
            base = base_scene["nodes"][0]
            params = particle_params(node, base)
            entry = {"kind": kind, "side": side, "name": node["name"], **params,
                     "texture": texture_url(reader, base.get("texture"), dry_run, cache)}
            if kind == "ring":
                material = read_resource(reader, base["material"])["resource"] if isinstance(base.get("material"), str) else {}
                entry["erosionCurve"] = curve_of(material.get("shader_parameter/erosion_curve"))
                entry["erosionOffset"] = material.get("shader_parameter/erosion_offset", 0.1)
            result["layers"].append(entry)
    return result


def card_trail(reader: PCKReader, character: str, dry_run: bool, cache: dict[str, str]) -> dict | None:
    path = f"scenes/vfx/card_trail_{character}.tscn"
    if path not in reader.entries:
        return None
    scene = read_resource(reader, path)
    by_name = {node["name"]: node for node in scene["nodes"]}

    def line(name: str) -> dict:
        node = by_name[name]
        return {
            "modulate": node.get("modulate", [1, 1, 1, 1]),
            "defaultColor": node.get("default_color", [1, 1, 1, 1]),
            "width": node.get("width", 10.0),
            "widthCurve": (node.get("width_curve") or {}).get("_data"),
            "gradient": gradient_of(node.get("gradient")),
            "texture": texture_url(reader, node.get("texture"), dry_run, cache),
        }

    def particles(name: str) -> dict:
        node = by_name[name]
        return {
            "amount": node.get("amount", 8.0),
            "lifetime": node.get("lifetime", 1.0),
            "explosiveness": node.get("explosiveness", 0.0),
            "lifetimeRandomness": node.get("lifetime_randomness", 0.0),
            "emissionRect": node.get("emission_rect_extents", [0, 0]),
            "direction": node.get("direction", [1, 0]),
            "spread": node.get("spread", 45.0),
            "gravity": node.get("gravity", [0, 980]),
            "velocityMin": node.get("initial_velocity_min", 0.0),
            "velocityMax": node.get("initial_velocity_max", 0.0),
            "dampingMin": node.get("damping_min", 0.0),
            "dampingMax": node.get("damping_max", 0.0),
            "scaleMin": node.get("scale_amount_min", 1.0),
            "scaleMax": node.get("scale_amount_max", 1.0),
            "colorRamp": gradient_of(node.get("color_ramp")),
            "texture": texture_url(reader, node.get("texture"), dry_run, cache),
        }

    sprites = [
        {"modulate": by_name[name].get("modulate", [1, 1, 1, 1]), "scale": by_name[name].get("scale", [1, 1]),
         "texture": texture_url(reader, by_name[name].get("texture"), dry_run, cache)}
        for name in ("Sprite2D2", "Sprite2D3") if name in by_name
    ]
    return {
        "scene": path,
        "outer": line("OuterTrail"),
        "inner": line("InnerTrail"),
        "sprites": sprites,
        "bigSparks": particles("BigSparks") if "BigSparks" in by_name else None,
        "littleSparks": particles("LittleSparks") if "LittleSparks" in by_name else None,
    }


def main() -> None:
    args = parse_args()
    manifest: dict = {
        "source": {"pck": pck_path(args), "archiveVersion": args.archive_version},
        "energyCounters": {}, "energyGainVfx": {}, "cardTrails": {}, "powerIcons": {}, "ui": {},
    }
    vfx_cache: dict[str, str] = {}
    with PCKReader(pck_path(args)) as reader:
        for character in CHARACTERS:
            scene = f"scenes/combat/energy_counters/{character}_energy_counter.tscn"
            if scene not in reader.entries:
                print(f"skip {character}: no {scene}")
                continue
            resources, nodes = parse_tscn(reader.read_file(scene).decode("utf-8"))
            layers = []
            rotation_index = 0
            for node in nodes:
                if node["type"] != "TextureRect" or node["parent"] not in ("Layers", "Layers/RotationLayers"):
                    continue
                texture = re.search(r'ExtResource\("([^"]+)"\)', node["props"].get("texture", ""))
                if not texture:
                    continue
                source = resources[texture.group(1)]
                out = OUT_ROOT / "energy-counters" / character / f"{Path(source).stem}.webp"
                export_texture(reader, source, out, args.dry_run)
                rotates = node["parent"] == "Layers/RotationLayers"
                layers.append({"name": node["name"], "url": url_of(out), "rotationIndex": rotation_index if rotates else None})
                if rotates:
                    rotation_index += 1
            label = next((node for node in nodes if node["name"] == "Label"), None)
            props = label["props"] if label else {}
            manifest["energyCounters"][character.upper()] = {
                "scene": scene,
                "size": 128,
                "layers": layers,
                "label": {
                    "fontColor": godot_color(props.get("theme_override_colors/font_color", "Color(1,1,1,1)")),
                    "outlineColor": godot_color(props.get("theme_override_colors/font_outline_color", "Color(0,0,0,1)")),
                    "shadowColor": godot_color(props.get("theme_override_colors/font_shadow_color", "Color(0,0,0,0)")),
                    "outlineSize": int(props.get("theme_override_constants/outline_size", "0")),
                    "shadowOffset": [int(props.get("theme_override_constants/shadow_offset_x", "0")), int(props.get("theme_override_constants/shadow_offset_y", "0"))],
                    "fontSize": int(props.get("theme_override_font_sizes/font_size", "36")),
                },
            }
            manifest["energyGainVfx"][character.upper()] = energy_gain_vfx(reader, character, args.dry_run, vfx_cache)
            manifest["cardTrails"][character.upper()] = card_trail(reader, character, args.dry_run, vfx_cache)
        for source in UI_TEXTURES:
            out = OUT_ROOT / "ui" / f"{Path(source).stem}.webp"
            export_texture(reader, source, out, args.dry_run)
            manifest["ui"][Path(source).stem] = url_of(out)
        for name in POWER_ICONS:
            source = f"images/powers/{name}.png"
            if f"{source}.import" not in reader.entries:
                print(f"skip {name}: not in this PCK")
                continue
            out = OUT_ROOT / "powers" / f"{name}.webp"
            export_texture(reader, source, out, args.dry_run)
            manifest["powerIcons"][name.upper()] = url_of(out)

    if args.dry_run:
        print(json.dumps(manifest, indent=2))
        return
    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    print(MANIFEST.relative_to(ROOT))


if __name__ == "__main__":
    main()
