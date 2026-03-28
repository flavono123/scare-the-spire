#!/usr/bin/env python3
"""Extract card portrait images from the local STS2 game PCK file.

Reads the Godot 4.x PCK file directly (no GDRE Tools needed),
finds card portrait .import -> .ctex mappings, extracts WebP data
from GST2 compressed textures, and converts to PNG.

Usage:
    python3 scripts/extract-card-portraits.py [options]

Options:
    --pck PATH       Path to the STS2 .pck file (auto-detected on macOS/Windows)
    --output DIR     Output directory (default: public/images/spire-codex/cards/)
    --beta-output DIR  Beta art output directory (default: public/images/spire-codex/cards-beta/)
    --dry-run        List files without extracting
    --diff-only      Only show cards where official art differs from beta art
    --force          Overwrite existing files
    --character NAME Only extract for a specific character (e.g., ironclad, silent)
"""

from __future__ import annotations

import argparse
import hashlib
import os
import re
import struct
import sys
from dataclasses import dataclass
from pathlib import Path

try:
    from PIL import Image
    HAS_PILLOW = True
except ImportError:
    HAS_PILLOW = False


# Default PCK paths per platform
DEFAULT_PCK_PATHS = {
    "darwin": os.path.expanduser(
        "~/Library/Application Support/Steam/steamapps/common/"
        "Slay the Spire 2/SlayTheSpire2.app/Contents/Resources/Slay the Spire 2.pck"
    ),
    "win32": r"C:\Program Files (x86)\Steam\steamapps\common\Slay the Spire 2\Slay the Spire 2.pck",
    "linux": os.path.expanduser(
        "~/.local/share/Steam/steamapps/common/Slay the Spire 2/Slay the Spire 2.pck"
    ),
}

PORTRAIT_PREFIX = "images/packed/card_portraits/"


@dataclass
class PCKEntry:
    path: str
    offset: int
    size: int
    md5: bytes
    flags: int


@dataclass
class CardPortrait:
    name: str        # e.g., "alchemize"
    character: str   # e.g., "colorless", "ironclad"
    is_beta: bool
    import_path: str
    ctex_path: str | None = None


class PCKReader:
    """Reads Godot 4.x PCK files (format version 2 and 3)."""

    def __init__(self, pck_path: str):
        self.pck_path = pck_path
        self.f = open(pck_path, "rb")
        self.files_base = 0
        self.entries: dict[str, PCKEntry] = {}
        self._read_header()

    def _read_header(self):
        f = self.f
        f.seek(0)

        magic = f.read(4)
        if magic != b"GDPC":
            raise ValueError(f"Not a Godot PCK file (magic: {magic})")

        pack_version = struct.unpack("<I", f.read(4))[0]
        ver_major = struct.unpack("<I", f.read(4))[0]
        ver_minor = struct.unpack("<I", f.read(4))[0]
        ver_patch = struct.unpack("<I", f.read(4))[0]

        self.godot_version = f"{ver_major}.{ver_minor}.{ver_patch}"
        self.pack_version = pack_version

        if pack_version >= 2:
            flags = struct.unpack("<I", f.read(4))[0]
            self.encrypted = bool(flags & 1)
            if self.encrypted:
                raise ValueError("Encrypted PCK files are not supported")

        if pack_version >= 3:
            # v3: files_base (uint64) + dir_offset (uint64) before reserved
            self.files_base = struct.unpack("<Q", f.read(8))[0]
            dir_offset = struct.unpack("<Q", f.read(8))[0]
            # Skip remaining reserved (12 uint32 = 48 bytes)
            f.read(48)
            # Read directory from dir_offset
            f.seek(dir_offset)
        else:
            # v1/v2: 16 reserved uint32 then file_count inline
            f.read(64)

        file_count = struct.unpack("<I", f.read(4))[0]

        for _ in range(file_count):
            path_len = struct.unpack("<I", f.read(4))[0]
            path = f.read(path_len).decode("utf-8").rstrip("\x00")
            offset = struct.unpack("<Q", f.read(8))[0]
            size = struct.unpack("<Q", f.read(8))[0]
            md5 = f.read(16)
            entry_flags = struct.unpack("<I", f.read(4))[0]
            self.entries[path] = PCKEntry(path, offset, size, md5, entry_flags)

        print(f"PCK v{pack_version}, Godot {self.godot_version}, {file_count} files, "
              f"files_base=0x{self.files_base:x}")

    def read_file(self, path: str) -> bytes:
        entry = self.entries[path]
        self.f.seek(self.files_base + entry.offset)
        return self.f.read(entry.size)

    def close(self):
        self.f.close()


def parse_import_file(raw: bytes) -> str | None:
    """Extract ctex path from a .import file's [remap] section."""
    idx = raw.find(b"[remap]")
    if idx < 0:
        return None
    text = raw[idx:].decode("utf-8", errors="replace")
    m = re.search(r'path="res://([^"]+)"', text)
    return m.group(1) if m else None


def extract_webp_from_ctex(raw: bytes) -> bytes | None:
    """Extract WebP image data from a GST2 compressed texture."""
    if len(raw) < 56:
        return None

    magic = raw[:4]
    if magic != b"GST2":
        return None

    # GST2 header: magic(4) + version(4) + width(4) + height(4) + flags(4) + limit(4) + reserved(12) = 36 bytes
    # Then: data_format(4)
    data_format = struct.unpack_from("<I", raw, 36)[0]

    if data_format == 2:  # WebP
        # width(2) + height(2) + mipmaps(4) + img_format(4) + data_size(4) = 16 bytes
        data_size = struct.unpack_from("<I", raw, 52)[0]
        webp_start = 56
        webp_data = raw[webp_start:webp_start + data_size]
        if webp_data[:4] == b"RIFF" and webp_data[8:12] == b"WEBP":
            return webp_data
    elif data_format == 1:  # PNG
        data_size = struct.unpack_from("<I", raw, 52)[0]
        png_start = 56
        png_data = raw[png_start:png_start + data_size]
        if png_data[:4] == b"\x89PNG":
            return png_data
    elif data_format == 0:  # Raw image
        # Need to reconstruct — skip for now
        pass

    return None


def find_card_portraits(reader: PCKReader) -> list[CardPortrait]:
    """Find all card portrait entries in the PCK."""
    portraits = []

    for path in reader.entries:
        if not path.startswith(PORTRAIT_PREFIX) or not path.endswith(".import"):
            continue

        rel = path[len(PORTRAIT_PREFIX):]
        parts = rel.split("/")

        if len(parts) == 1:
            # Root level (e.g., ancient_beta.png.import)
            continue

        character = parts[0]
        is_beta = "beta" in parts[1:-1]
        filename = parts[-1].replace(".import", "")  # e.g., alchemize.png
        name = filename.replace(".png", "")

        portraits.append(CardPortrait(
            name=name,
            character=character,
            is_beta=is_beta,
            import_path=path,
        ))

    return portraits


def resolve_ctex_paths(reader: PCKReader, portraits: list[CardPortrait]):
    """Resolve .import files to their .ctex paths."""
    for p in portraits:
        raw = reader.read_file(p.import_path)
        ctex_path = parse_import_file(raw)
        if ctex_path and ctex_path in reader.entries:
            p.ctex_path = ctex_path


def webp_to_png(webp_data: bytes) -> bytes:
    """Convert WebP bytes to PNG bytes."""
    if HAS_PILLOW:
        import io
        img = Image.open(io.BytesIO(webp_data))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()
    else:
        # Fallback: use sips on macOS
        import subprocess
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".webp", delete=False) as tmp_in:
            tmp_in.write(webp_data)
            tmp_in_path = tmp_in.name
        tmp_out_path = tmp_in_path.replace(".webp", ".png")
        try:
            subprocess.run(
                ["sips", "-s", "format", "png", tmp_in_path, "--out", tmp_out_path],
                capture_output=True, check=True,
            )
            with open(tmp_out_path, "rb") as f:
                return f.read()
        finally:
            os.unlink(tmp_in_path)
            if os.path.exists(tmp_out_path):
                os.unlink(tmp_out_path)


def extract_portrait(reader: PCKReader, portrait: CardPortrait) -> bytes | None:
    """Extract a single card portrait as PNG bytes."""
    if not portrait.ctex_path:
        return None

    raw = reader.read_file(portrait.ctex_path)
    image_data = extract_webp_from_ctex(raw)

    if image_data is None:
        return None

    if image_data[:4] == b"\x89PNG":
        return image_data

    return webp_to_png(image_data)


def get_game_version(pck_path: str) -> str | None:
    """Read game version from release_info.json next to PCK."""
    import json
    pck_dir = os.path.dirname(pck_path)
    info_path = os.path.join(pck_dir, "release_info.json")
    if os.path.exists(info_path):
        with open(info_path) as f:
            data = json.load(f)
            return data.get("version", None)
    return None


def main():
    parser = argparse.ArgumentParser(description="Extract STS2 card portraits from PCK")
    parser.add_argument("--pck", help="Path to PCK file")
    parser.add_argument("--output", help="Output directory for official art")
    parser.add_argument("--beta-output", help="Output directory for beta art")
    parser.add_argument("--dry-run", action="store_true", help="List files without extracting")
    parser.add_argument("--diff-only", action="store_true", help="Only show new/changed art")
    parser.add_argument("--force", action="store_true", help="Overwrite existing files")
    parser.add_argument("--character", help="Only extract for a specific character")
    args = parser.parse_args()

    # Find PCK
    pck_path = args.pck or DEFAULT_PCK_PATHS.get(sys.platform)
    if not pck_path or not os.path.exists(pck_path):
        print(f"PCK file not found: {pck_path}")
        print("Use --pck to specify the path manually")
        sys.exit(1)

    # Project root
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    output_dir = args.output or os.path.join(project_root, "public/images/spire-codex/cards")
    beta_output_dir = args.beta_output or os.path.join(project_root, "public/images/spire-codex/cards-beta")

    game_version = get_game_version(pck_path)
    if game_version:
        print(f"Game version: {game_version}")

    reader = PCKReader(pck_path)

    # Find portraits
    portraits = find_card_portraits(reader)
    print(f"Found {len(portraits)} card portraits "
          f"({sum(1 for p in portraits if not p.is_beta)} official, "
          f"{sum(1 for p in portraits if p.is_beta)} beta)")

    if args.character:
        portraits = [p for p in portraits if p.character == args.character]
        print(f"Filtered to {len(portraits)} portraits for '{args.character}'")

    # Resolve ctex paths
    resolve_ctex_paths(reader, portraits)
    resolved = [p for p in portraits if p.ctex_path]
    print(f"Resolved {len(resolved)}/{len(portraits)} ctex paths")

    # Group by official/beta
    official = [p for p in resolved if not p.is_beta]
    beta = [p for p in resolved if p.is_beta]

    stats = {"extracted": 0, "skipped": 0, "failed": 0, "new": 0, "updated": 0}

    for group, out_dir, label in [(official, output_dir, "official"), (beta, beta_output_dir, "beta")]:
        os.makedirs(out_dir, exist_ok=True)

        for portrait in sorted(group, key=lambda p: p.name):
            out_path = os.path.join(out_dir, f"{portrait.name}.png")
            exists = os.path.exists(out_path)

            if args.dry_run:
                status = "EXISTS" if exists else "NEW"
                print(f"  [{status}] {label}/{portrait.character}/{portrait.name}.png")
                continue

            if exists and not args.force and not args.diff_only:
                stats["skipped"] += 1
                continue

            png_data = extract_portrait(reader, portrait)
            if png_data is None:
                stats["failed"] += 1
                print(f"  [FAIL] {portrait.name} (could not extract from ctex)")
                continue

            if exists and args.diff_only:
                # Compare with existing
                with open(out_path, "rb") as f:
                    existing = f.read()
                if existing == png_data:
                    stats["skipped"] += 1
                    continue
                # Check by image content hash (size may differ due to PNG compression)
                existing_hash = hashlib.md5(existing).hexdigest()
                new_hash = hashlib.md5(png_data).hexdigest()
                if existing_hash == new_hash:
                    stats["skipped"] += 1
                    continue
                print(f"  [UPDATED] {label}/{portrait.name}.png ({portrait.character})")
                stats["updated"] += 1
            elif not exists:
                print(f"  [NEW] {label}/{portrait.name}.png ({portrait.character})")
                stats["new"] += 1

            if not args.diff_only or not exists or stats["updated"] > 0:
                with open(out_path, "wb") as f:
                    f.write(png_data)
                stats["extracted"] += 1

    reader.close()

    print(f"\nDone: {stats['extracted']} extracted, {stats['new']} new, "
          f"{stats['updated']} updated, {stats['skipped']} skipped, {stats['failed']} failed")


if __name__ == "__main__":
    main()
