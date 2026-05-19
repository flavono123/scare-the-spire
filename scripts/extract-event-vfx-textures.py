#!/usr/bin/env python3
"""Extract STS2 event VFX textures from the local PCK.

Event background art in Codex uses static `events/*.webp` files. Several game
events layer additional Texture2D resources from `scenes/vfx/events/*_vfx.tscn`.
This script extracts those event-specific textures and writes a manifest that
maps each VFX scene to the extracted assets.
"""

from __future__ import annotations

import argparse
import json
import re
import struct
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.lib.ctex import parse_import_file
from scripts.lib.pck import PCKReader, default_pck_path


OUT_ROOT = ROOT / "public/images/sts2/event-vfx"
MANIFEST_PATH = ROOT / "data/sts2/event-vfx-textures.json"
SCENE_RE = re.compile(r"^scenes/vfx/events/(?P<slug>.+)_vfx\.tscn$")
TEXTURE_RE = re.compile(r'\[ext_resource[^\]]*type="Texture2D"[^\]]*path="res://(?P<path>[^"]+)"')
EVENT_TEXTURE_PREFIX = "images/packed/vfx/event/"


@dataclass(frozen=True)
class ExtractedTexture:
    source: str
    output_path: Path
    public_url: str
    width: int
    height: int


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pck", default=default_pck_path(), help="Path to Slay the Spire 2.pck")
    parser.add_argument("--output-root", default=str(OUT_ROOT), help="Texture output directory")
    parser.add_argument("--manifest", default=str(MANIFEST_PATH), help="JSON manifest path")
    parser.add_argument("--force", action="store_true", help="Rewrite existing output files")
    parser.add_argument("--dry-run", action="store_true", help="List work without writing files")
    return parser.parse_args()


def scene_texture_paths(reader: PCKReader, scene_path: str) -> list[str]:
    text = reader.read_file(scene_path).decode("utf-8", errors="replace")
    return sorted(
        {
            match.group("path")
            for match in TEXTURE_RE.finditer(text)
            if match.group("path").startswith(EVENT_TEXTURE_PREFIX)
        }
    )


def output_path_for(source_path: str, output_root: Path) -> Path:
    relative = Path(source_path.removeprefix(EVENT_TEXTURE_PREFIX))
    return output_root / relative.with_suffix(".webp")


def public_url_for(output_path: Path) -> str:
    relative = output_path.relative_to(ROOT / "public")
    return "/" + relative.as_posix()


def ctex_payload(raw: bytes) -> tuple[bytes, str, int, int] | None:
    if len(raw) < 56 or raw[:4] != b"GST2":
        return None

    width = struct.unpack_from("<I", raw, 8)[0]
    height = struct.unpack_from("<I", raw, 12)[0]
    data_format = struct.unpack_from("<I", raw, 36)[0]
    data_size = struct.unpack_from("<I", raw, 52)[0]
    payload = raw[56 : 56 + data_size]

    if data_format == 2 and payload[:4] == b"RIFF" and payload[8:12] == b"WEBP":
        return payload, ".webp", width, height
    if data_format == 1 and payload[:4] == b"\x89PNG":
        return payload, ".png", width, height
    return None


def extract_texture(reader: PCKReader, source_path: str, output_root: Path) -> ExtractedTexture | None:
    import_path = f"{source_path}.import"
    if import_path not in reader.entries:
        print(f"skip {source_path}: missing import")
        return None

    ctex_path = parse_import_file(reader.read_file(import_path))
    if not ctex_path or ctex_path not in reader.entries:
        print(f"skip {source_path}: missing ctex")
        return None

    payload = ctex_payload(reader.read_file(ctex_path))
    if payload is None:
        print(f"skip {source_path}: unsupported texture payload")
        return None

    data, suffix, width, height = payload
    output_path = output_path_for(source_path, output_root).with_suffix(suffix)
    return ExtractedTexture(
        source=source_path,
        output_path=output_path,
        public_url=public_url_for(output_path),
        width=width,
        height=height,
    ), data


def write_manifest(manifest_path: Path, manifest: dict[str, list[dict]], dry_run: bool) -> None:
    text = json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if dry_run:
        print(f"would write {manifest_path}")
        return
    if manifest_path.exists() and manifest_path.read_text() == text:
        return
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(text)


def main() -> int:
    args = parse_args()
    output_root = Path(args.output_root)
    manifest_path = Path(args.manifest)
    manifest: dict[str, list[dict]] = {}
    written = 0
    skipped = 0

    with PCKReader(args.pck) as reader:
        scenes = sorted(
            (match.group("slug"), path)
            for path in reader.entries
            if (match := SCENE_RE.match(path))
        )

        extracted_by_source: dict[str, tuple[ExtractedTexture, bytes]] = {}
        for slug, scene_path in scenes:
            scene_assets: list[dict] = []
            for source_path in scene_texture_paths(reader, scene_path):
                if source_path not in extracted_by_source:
                    result = extract_texture(reader, source_path, output_root)
                    if result is None:
                        skipped += 1
                        continue
                    extracted_by_source[source_path] = result

                texture, data = extracted_by_source[source_path]
                scene_assets.append(
                    {
                        "height": texture.height,
                        "source": texture.source,
                        "src": texture.public_url,
                        "width": texture.width,
                    }
                )

                if texture.output_path.exists() and not args.force:
                    continue
                if texture.output_path.exists() and texture.output_path.read_bytes() == data:
                    continue
                if args.dry_run:
                    print(f"would write {texture.output_path}")
                    continue
                texture.output_path.parent.mkdir(parents=True, exist_ok=True)
                texture.output_path.write_bytes(data)
                written += 1

            if scene_assets:
                manifest[slug] = scene_assets

    write_manifest(manifest_path, manifest, args.dry_run)
    print(f"event vfx scenes={len(manifest)} written={written} skipped={skipped}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
