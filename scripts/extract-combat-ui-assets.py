#!/usr/bin/env python3
"""Extract combat UI pieces for the dev combat simulator from a STS2 PCK.

- Energy counters: `scenes/combat/energy_counters/<character>_energy_counter.tscn`.
  Each TextureRect under `Layers` is exported in draw order; children of
  `Layers/RotationLayers` are marked with their rotation index (NEnergyCounter
  turns child i at (i + 1) * 30 deg/s, 5 deg/s at 0 energy). The Label's colors
  and sizes are copied into the manifest.
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


def main() -> None:
    args = parse_args()
    manifest: dict = {"source": {"pck": pck_path(args), "archiveVersion": args.archive_version}, "energyCounters": {}, "powerIcons": {}}
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
