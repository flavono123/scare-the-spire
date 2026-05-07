#!/usr/bin/env python3
"""Extract one STS2 Spine actor from the local Godot PCK.

Given an import prefix such as `animations/characters/defect/defect`, this
writes `<name>.atlas`, `<name>.skel`, and `<name>.png` to the output folder.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import lib.ctex as ctex  # noqa: E402
from lib.ctex import ctex_to_image, parse_import_file  # noqa: E402
from lib.pck import PCKReader, default_pck_path  # noqa: E402


IMPORT_RE = re.compile(r'path(?:\.\w+)?\s*=\s*"res://([^"]+)"')


def import_target(raw: bytes) -> str | None:
    text = raw.decode("utf-8", errors="replace")
    remap = text[text.find("[remap]") :] if "[remap]" in text else text
    match = IMPORT_RE.search(remap)
    return match.group(1) if match else None


def extract_binary_import(reader: PCKReader, import_path: str, out_path: Path) -> str:
    raw_import = reader.read_file(import_path)
    target = import_target(raw_import)
    if not target or target not in reader.entries:
        raise FileNotFoundError(f"{import_path}: imported target not found: {target}")
    payload = reader.read_file(target)
    if out_path.suffix == ".atlas":
        try:
            wrapped = json.loads(payload.decode("utf-8"))
            if isinstance(wrapped, dict) and isinstance(wrapped.get("atlas_data"), str):
                payload = wrapped["atlas_data"].encode("utf-8")
        except (UnicodeDecodeError, json.JSONDecodeError):
            pass
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(payload)
    return target


def extract_png_import(reader: PCKReader, import_path: str, out_path: Path) -> str:
    raw_import = reader.read_file(import_path)
    target = parse_import_file(raw_import)
    if not target or target not in reader.entries:
        raise FileNotFoundError(f"{import_path}: texture target not found: {target}")
    image = ctex_to_image(reader.read_file(target))
    if image is None:
        raise RuntimeError(f"{import_path}: could not decode texture target: {target}")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(out_path)
    return target


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract STS2 Spine actor files from PCK.")
    parser.add_argument("--asset", required=True, help="Import prefix, e.g. animations/characters/defect/defect")
    parser.add_argument("--out", required=True, help="Output directory for .atlas/.skel/.png")
    parser.add_argument("--pck", default=default_pck_path(), help="Path to STS2 PCK")
    parser.add_argument("--name", help="Output basename. Defaults to the asset basename.")
    args = parser.parse_args()

    if ctex.Image is None:
        raise RuntimeError("Pillow is required to decode Godot .ctex textures. Install with: python3 -m pip install Pillow")

    asset = args.asset.rstrip("/")
    name = args.name or Path(asset).name
    out_dir = Path(args.out).expanduser().resolve()
    atlas_import = f"{asset}.atlas.import"
    skel_import = f"{asset}.skel.import"
    png_import = f"{asset}.png.import"

    with PCKReader(args.pck) as reader:
        missing = [p for p in [atlas_import, skel_import, png_import] if p not in reader.entries]
        if missing:
            raise FileNotFoundError("missing import resources: " + ", ".join(missing))

        atlas_target = extract_binary_import(reader, atlas_import, out_dir / f"{name}.atlas")
        skel_target = extract_binary_import(reader, skel_import, out_dir / f"{name}.skel")
        png_target = extract_png_import(reader, png_import, out_dir / f"{name}.png")

    print(f"extracted {asset}")
    print(f"  atlas: {atlas_target} -> {out_dir / f'{name}.atlas'}")
    print(f"  skel:  {skel_target} -> {out_dir / f'{name}.skel'}")
    print(f"  png:   {png_target} -> {out_dir / f'{name}.png'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
