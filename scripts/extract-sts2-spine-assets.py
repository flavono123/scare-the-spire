#!/usr/bin/env python3
"""Extract renderable STS2 Spine actors from the local Godot PCK.

The script writes browser-servable `.atlas`, `.skel`, and `.png` files under
`public/spine/sts2/<kind>/<actor-folder>/`. It only extracts actor prefixes
that have all three Godot imports, so static-only monsters remain on the
existing portrait fallback path.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import lib.ctex as ctex  # noqa: E402
from lib.ctex import ctex_to_image, parse_import_file  # noqa: E402
from lib.pck import PCKReader, default_pck_path  # noqa: E402


IMPORT_RE = re.compile(r'path(?:\.\w+)?\s*=\s*"res://([^"]+)"')
DEFAULT_KINDS = ("monsters", "vfx")
PCK_PREFIX_BY_KIND = {
    "monsters": "animations/monsters/",
    "vfx": "animations/vfx/",
}


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


def atlas_page_names(atlas_path: Path) -> list[str]:
    lines = atlas_path.read_text("utf-8").splitlines()
    pages: list[str] = []
    for index, line in enumerate(lines[:-1]):
        stripped = line.strip()
        next_line = lines[index + 1].strip()
        if (
            stripped
            and not line.startswith((" ", "\t"))
            and ":" not in stripped
            and stripped.lower().endswith((".png", ".webp", ".jpg", ".jpeg"))
            and next_line.startswith("size:")
        ):
            pages.append(stripped)
    return pages


def discover_actor_prefixes(reader: PCKReader, kind: str) -> list[str]:
    pck_prefix = PCK_PREFIX_BY_KIND[kind]
    prefixes = sorted(
        path[: -len(".skel.import")]
        for path in reader.entries
        if path.endswith(".skel.import") and path.startswith(pck_prefix)
    )
    return [
        prefix
        for prefix in prefixes
        if f"{prefix}.atlas.import" in reader.entries and f"{prefix}.png.import" in reader.entries
    ]


def output_folder_for(prefix: str, kind: str, out_root: Path) -> Path:
    pck_prefix = PCK_PREFIX_BY_KIND[kind]
    relative = prefix[len(pck_prefix) :]
    folder = Path(relative).parent
    if str(folder) == ".":
        folder = Path(Path(prefix).stem)
    return out_root / kind / folder


def extract_actor(reader: PCKReader, prefix: str, kind: str, out_root: Path) -> None:
    base_name = Path(prefix).name
    actor_dir = Path(prefix).parent.as_posix()
    out_dir = output_folder_for(prefix, kind, out_root)
    atlas_path = out_dir / f"{base_name}.atlas"
    extract_binary_import(reader, f"{prefix}.atlas.import", atlas_path)
    extract_binary_import(reader, f"{prefix}.skel.import", out_dir / f"{base_name}.skel")
    page_names = atlas_page_names(atlas_path) or [f"{base_name}.png"]
    for page_name in page_names:
        page_import = f"{actor_dir}/{page_name}.import"
        if page_import not in reader.entries and page_name == f"{base_name}.png":
            page_import = f"{prefix}.png.import"
        extract_png_import(reader, page_import, out_dir / page_name)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pck", default=default_pck_path(), help="Path to Slay the Spire 2.pck")
    parser.add_argument(
        "--kind",
        action="append",
        choices=DEFAULT_KINDS,
        help="Asset kind to extract. Repeatable. Defaults to monsters and vfx.",
    )
    parser.add_argument("--out-root", default="public/spine/sts2", help="Output root under the repo")
    parser.add_argument("--force", action="store_true", help="Clear selected output folders before extraction")
    args = parser.parse_args()

    if ctex.Image is None:
        raise RuntimeError("Pillow is required to decode Godot .ctex textures. Install with: python3 -m pip install Pillow")

    kinds = tuple(args.kind or DEFAULT_KINDS)
    out_root = (REPO_ROOT / args.out_root).resolve()

    if args.force:
        for kind in kinds:
            shutil.rmtree(out_root / kind, ignore_errors=True)

    with PCKReader(args.pck) as reader:
        for kind in kinds:
            prefixes = discover_actor_prefixes(reader, kind)
            for prefix in prefixes:
                extract_actor(reader, prefix, kind, out_root)
            print(f"extracted {len(prefixes)} {kind} Spine actors to {out_root / kind}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
