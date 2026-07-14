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
from dataclasses import dataclass
from pathlib import Path

from PIL import Image


REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import lib.ctex as ctex  # noqa: E402
from lib.ctex import ctex_to_image, parse_import_file  # noqa: E402
from lib.pck import PCKReader, default_pck_path  # noqa: E402


IMPORT_RE = re.compile(r'path(?:\.\w+)?\s*=\s*"res://([^"]+)"')
DEFAULT_KINDS = ("monsters", "vfx")
AVAILABLE_KINDS = (
    "monsters",
    "vfx",
    "characters",
    "character-select",
    "ancients",
    "event-backgrounds",
    "encounter-backgrounds",
)
PCK_PREFIX_BY_KIND = {
    "ancients": "animations/backgrounds/",
    "character-select": "animations/character_select/",
    "characters": "animations/characters/",
    "encounter-backgrounds": "scenes/backgrounds/queen_boss/",
    "event-backgrounds": "animations/backgrounds/",
    "monsters": "animations/monsters/",
    "vfx": "animations/vfx/",
}
ANCIENT_SPINE_PREFIXES = {
    "animations/backgrounds/neow_room/neow",
    "animations/backgrounds/tezcatara/tezcatara",
}
EVENT_BACKGROUND_SPINE_PREFIXES = {
    "animations/backgrounds/fake_merchant_room/bottom/shop_fake_merchant_bottom",
    "animations/backgrounds/fake_merchant_room/bottom/shop_fake_merchant_bottom_cutter",
    "animations/backgrounds/fake_merchant_room/top/fake_merchant_top",
}
SPINE_TEXTURE_SCALE_BY_PREFIX = {
    # These two atlases are displayed at roughly half scale in fake_merchant.tscn.
    # Keeping their source dimensions would decode to about 140 MiB in the browser.
    "animations/backgrounds/fake_merchant_room/bottom/shop_fake_merchant_bottom": 0.5,
    "animations/backgrounds/fake_merchant_room/bottom/shop_fake_merchant_bottom_cutter": 0.5,
}
CHARACTER_SELECT_STATIC_IMPORTS = {
    "animations/character_select/silent/character_select_silent_bg.png.import": "character_select_silent_bg.webp",
    "animations/character_select/necrobinder/character_select_necrobinder_bg.png.import": "character_select_necrobinder_bg.webp",
    "images/vfx/characters/necro_character_select_fire_shape.png.import": "necro_character_select_fire_shape.webp",
    "images/vfx/characters/osty_character_select_fire_shape.png.import": "osty_character_select_fire_shape.webp",
}


@dataclass(frozen=True)
class SpineActorImport:
    skel_prefix: str
    atlas_prefix: str
    output_folder: str | None = None


MANUAL_ACTOR_IMPORTS = {
    "monsters": (
        SpineActorImport(
            skel_prefix="animations/backgrounds/fake_merchant_room/top/fake_merchant_top",
            atlas_prefix="animations/backgrounds/fake_merchant_room/top/fake_merchant_top",
            output_folder="fake_merchant_monster",
        ),
        SpineActorImport(
            skel_prefix="animations/monsters/decimillipede/decimillipede1",
            atlas_prefix="animations/monsters/decimillipede/decimillipede_front",
            output_folder="decimillipede_front",
        ),
        SpineActorImport(
            skel_prefix="animations/monsters/decimillipede/decimillipede2",
            atlas_prefix="animations/monsters/decimillipede/decimillipede_middle",
            output_folder="decimillipede_middle",
        ),
        SpineActorImport(
            skel_prefix="animations/monsters/decimillipede/decimillipede3",
            atlas_prefix="animations/monsters/decimillipede/decimillipede_back",
            output_folder="decimillipede_back",
        ),
    ),
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


def extract_png_import(reader: PCKReader, import_path: str, out_path: Path, scale: float = 1.0) -> str:
    raw_import = reader.read_file(import_path)
    target = parse_import_file(raw_import)
    if not target or target not in reader.entries:
        raise FileNotFoundError(f"{import_path}: texture target not found: {target}")

    image = ctex_to_image(reader.read_file(target))
    if image is None:
        raise RuntimeError(f"{import_path}: could not decode texture target: {target}")

    if scale != 1.0:
        image = image.resize(
            (round(image.width * scale), round(image.height * scale)),
            Image.Resampling.LANCZOS,
        )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(out_path, optimize=scale != 1.0)
    return target


def scale_atlas(atlas_path: Path, scale: float) -> None:
    geometry_fields = {"bounds", "offset", "offsets", "orig", "size", "xy"}
    scaled_lines: list[str] = []
    for line in atlas_path.read_text("utf-8").splitlines():
        field, separator, raw_values = line.partition(":")
        if separator and field in geometry_fields:
            values = [value.strip() for value in raw_values.split(",")]
            try:
                line = f"{field}:{','.join(str(round(int(value) * scale)) for value in values)}"
            except ValueError:
                pass
        scaled_lines.append(line)
    atlas_path.write_text("\n".join(scaled_lines) + "\n", "utf-8")


def extract_webp_import(reader: PCKReader, import_path: str, out_path: Path, force: bool) -> bool:
    if out_path.exists() and not force:
        return False

    raw_import = reader.read_file(import_path)
    target = parse_import_file(raw_import)
    if not target or target not in reader.entries:
        raise FileNotFoundError(f"{import_path}: texture target not found: {target}")

    image = ctex_to_image(reader.read_file(target))
    if image is None:
        raise RuntimeError(f"{import_path}: could not decode texture target: {target}")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(out_path, "WEBP", quality=95, method=6)
    return True


def extract_character_select_static_images(reader: PCKReader, force: bool) -> int:
    out_dir = REPO_ROOT / "public/images/sts2/character-select"
    written = 0
    for import_path, filename in CHARACTER_SELECT_STATIC_IMPORTS.items():
        if import_path not in reader.entries:
            continue
        if extract_webp_import(reader, import_path, out_dir / filename, force):
            written += 1
    return written


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


def discover_actor_imports(reader: PCKReader, kind: str) -> list[SpineActorImport]:
    pck_prefix = PCK_PREFIX_BY_KIND[kind]
    prefixes = sorted(
        path[: -len(".skel.import")]
        for path in reader.entries
        if path.endswith(".skel.import") and path.startswith(pck_prefix)
    )
    manual_actors = [
        actor
        for actor in MANUAL_ACTOR_IMPORTS.get(kind, ())
        if f"{actor.skel_prefix}.skel.import" in reader.entries
        and f"{actor.atlas_prefix}.atlas.import" in reader.entries
    ]
    manual_prefixes = {actor.skel_prefix for actor in manual_actors}
    if kind == "ancients":
        prefixes = [prefix for prefix in prefixes if prefix in ANCIENT_SPINE_PREFIXES]
    elif kind == "event-backgrounds":
        prefixes = [prefix for prefix in prefixes if prefix in EVENT_BACKGROUND_SPINE_PREFIXES]
    exact_renderable_dirs = {
        Path(prefix).parent.as_posix()
        for prefix in prefixes
        if f"{prefix}.atlas.import" in reader.entries and f"{prefix}.png.import" in reader.entries
    }
    actors: list[SpineActorImport] = list(manual_actors)
    for skel_prefix in prefixes:
        if skel_prefix in manual_prefixes:
            continue
        if f"{skel_prefix}.atlas.import" in reader.entries and f"{skel_prefix}.png.import" in reader.entries:
            actors.append(SpineActorImport(skel_prefix=skel_prefix, atlas_prefix=skel_prefix))
            continue

        actor_dir = Path(skel_prefix).parent.as_posix()
        if actor_dir in exact_renderable_dirs:
            continue

        folder_name = Path(actor_dir).name
        preferred_prefix = f"{actor_dir}/{folder_name}"
        if f"{preferred_prefix}.atlas.import" in reader.entries and f"{preferred_prefix}.png.import" in reader.entries:
            actors.append(SpineActorImport(skel_prefix=skel_prefix, atlas_prefix=preferred_prefix))
            continue

        sibling_atlas_prefixes = sorted(
            path[: -len(".atlas.import")]
            for path in reader.entries
            if path.endswith(".atlas.import") and Path(path).parent.as_posix() == actor_dir
        )
        renderable_atlas_prefixes = [
            atlas_prefix
            for atlas_prefix in sibling_atlas_prefixes
            if f"{atlas_prefix}.png.import" in reader.entries
        ]
        if len(renderable_atlas_prefixes) == 1:
            actors.append(SpineActorImport(skel_prefix=skel_prefix, atlas_prefix=renderable_atlas_prefixes[0]))
    return actors


def output_folder_for(actor: SpineActorImport, kind: str, out_root: Path) -> Path:
    if actor.output_folder:
        return out_root / kind / actor.output_folder

    pck_prefix = PCK_PREFIX_BY_KIND[kind]
    prefix = actor.skel_prefix
    relative = prefix[len(pck_prefix) :]
    folder = Path(relative).parent
    if str(folder) == ".":
        folder = Path(Path(prefix).stem)
    return out_root / kind / folder


def extract_actor(reader: PCKReader, actor: SpineActorImport, kind: str, out_root: Path) -> None:
    skel_base_name = Path(actor.skel_prefix).name
    atlas_base_name = Path(actor.atlas_prefix).name
    actor_dir = Path(actor.atlas_prefix).parent.as_posix()
    out_dir = output_folder_for(actor, kind, out_root)
    atlas_path = out_dir / f"{atlas_base_name}.atlas"
    extract_binary_import(reader, f"{actor.atlas_prefix}.atlas.import", atlas_path)
    texture_scale = SPINE_TEXTURE_SCALE_BY_PREFIX.get(actor.atlas_prefix, 1.0)
    if texture_scale != 1.0:
        scale_atlas(atlas_path, texture_scale)
    extract_binary_import(reader, f"{actor.skel_prefix}.skel.import", out_dir / f"{skel_base_name}.skel")
    page_names = atlas_page_names(atlas_path) or [f"{atlas_base_name}.png"]
    for page_name in page_names:
        page_import = f"{actor_dir}/{page_name}.import"
        if page_import not in reader.entries and page_name == f"{atlas_base_name}.png":
            page_import = f"{actor.atlas_prefix}.png.import"
        extract_png_import(reader, page_import, out_dir / page_name, texture_scale)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pck", default=default_pck_path(), help="Path to Slay the Spire 2.pck")
    parser.add_argument(
        "--kind",
        action="append",
        choices=AVAILABLE_KINDS,
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
            actors = discover_actor_imports(reader, kind)
            for actor in actors:
                extract_actor(reader, actor, kind, out_root)
            print(f"extracted {len(actors)} {kind} Spine actors to {out_root / kind}")
            if kind == "character-select":
                written = extract_character_select_static_images(reader, args.force)
                print(f"extracted {written} character-select static images")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
