#!/usr/bin/env python3
"""Extract navigation UI icons from the STS2 PCK file.

Extracts patch notes icon, compendium submenu icons, and other
UI assets needed for the site's navigation redesign.
"""

from __future__ import annotations

import io
import os
import struct
import re
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

try:
    from PIL import Image
    HAS_PILLOW = True
except ImportError:
    HAS_PILLOW = False


@dataclass
class PCKEntry:
    path: str
    offset: int
    size: int
    md5: bytes
    flags: int


class PCKReader:
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
            raise ValueError(f"Not a Godot PCK file")
        pack_version = struct.unpack("<I", f.read(4))[0]
        ver_major = struct.unpack("<I", f.read(4))[0]
        ver_minor = struct.unpack("<I", f.read(4))[0]
        ver_patch = struct.unpack("<I", f.read(4))[0]
        if pack_version >= 2:
            flags = struct.unpack("<I", f.read(4))[0]
        if pack_version >= 3:
            self.files_base = struct.unpack("<Q", f.read(8))[0]
            dir_offset = struct.unpack("<Q", f.read(8))[0]
            f.read(48)
            f.seek(dir_offset)
        else:
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
        print(f"PCK v{pack_version}, Godot {ver_major}.{ver_minor}.{ver_patch}, {file_count} files")

    def read_file(self, path: str) -> bytes:
        entry = self.entries[path]
        self.f.seek(self.files_base + entry.offset)
        return self.f.read(entry.size)

    def close(self):
        self.f.close()


def parse_import_file(raw: bytes) -> str | None:
    idx = raw.find(b"[remap]")
    if idx < 0:
        return None
    text = raw[idx:].decode("utf-8", errors="replace")
    m = re.search(r'path="res://([^"]+)"', text)
    return m.group(1) if m else None


def extract_webp_from_ctex(raw: bytes) -> bytes | None:
    if len(raw) < 56 or raw[:4] != b"GST2":
        return None
    data_format = struct.unpack_from("<I", raw, 36)[0]
    if data_format in (1, 2):  # PNG or WebP
        data_size = struct.unpack_from("<I", raw, 52)[0]
        return raw[56:56 + data_size]
    return None


def webp_to_png(webp_data: bytes) -> bytes:
    if HAS_PILLOW:
        img = Image.open(io.BytesIO(webp_data))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()
    else:
        with tempfile.NamedTemporaryFile(suffix=".webp", delete=False) as tmp:
            tmp.write(webp_data)
            tmp_path = tmp.name
        out_path = tmp_path.replace(".webp", ".png")
        subprocess.run(["sips", "-s", "format", "png", tmp_path, "--out", out_path],
                       capture_output=True)
        data = Path(out_path).read_bytes()
        os.unlink(tmp_path)
        os.unlink(out_path)
        return data

DEFAULT_PCK = os.path.expanduser(
    "~/Library/Application Support/Steam/steamapps/common/"
    "Slay the Spire 2/SlayTheSpire2.app/Contents/Resources/Slay the Spire 2.pck"
)

# Assets to extract: (pck_import_path_pattern, output_filename)
TARGETS = [
    # Patch notes icon (main menu top-right)
    ("images/ui/main_menu/patch_notes_icon.png", "patch_notes_icon"),

    # Compendium submenu icons (rich art, good for dropdowns)
    ("images/ui/main_menu/submenu_card_library.png", "submenu_cards"),
    ("images/ui/main_menu/submenu_relic_collection.png", "submenu_relics"),
    ("images/ui/main_menu/submenu_potion_lab.png", "submenu_potions"),
    ("images/ui/main_menu/submenu_bestiary.png", "submenu_bestiary"),
    ("images/packed/common_ui/submenu_compendium_button.png", "submenu_compendium"),

    # Run history icons (compact, good for inline/dropdown)
    ("images/ui/run_history/event.png", "run_history_event"),
    ("images/ui/run_history/monster.png", "run_history_monster"),
    ("images/ui/run_history/ancient.png", "run_history_ancient"),

    # Statistics icons (compact badges)
    ("images/packed/statistics_screen/stats_cards.png", "stats_cards"),
    ("images/packed/statistics_screen/stats_monsters.png", "stats_monsters"),
    ("images/packed/statistics_screen/stats_potions_seen.png", "stats_potions"),
    ("images/packed/statistics_screen/stats_ancients.png", "stats_ancients"),

    # Discovery icons (badge-style)
    ("images/ui/game_over_screen/discovery_card.png", "discovery_card"),
    ("images/ui/game_over_screen/discovery_monster.png", "discovery_monster"),
    ("images/ui/game_over_screen/discovery_potion.png", "discovery_potion"),
    ("images/ui/game_over_screen/discovery_relic.png", "discovery_relic"),

    # Quill cursor (candidate for report icon)
    ("images/packed/common_ui/cursor_quill.png", "cursor_quill"),

    # Relic candidates for report icon
    ("images/relics/tiny_mailbox.png", "relic_tiny_mailbox"),
    ("images/relics/letter_opener.png", "relic_letter_opener"),
]


def main():
    output_dir = Path(__file__).parent.parent / "public" / "images" / "sts2" / "nav"
    output_dir.mkdir(parents=True, exist_ok=True)

    reader = PCKReader(DEFAULT_PCK)

    extracted = 0
    failed = 0

    for source_path, output_name in TARGETS:
        import_path = source_path + ".import"

        if import_path not in reader.entries:
            print(f"  SKIP  {source_path} (no .import)")
            failed += 1
            continue

        raw_import = reader.read_file(import_path)
        ctex_path = parse_import_file(raw_import)

        if not ctex_path or ctex_path not in reader.entries:
            print(f"  SKIP  {source_path} (no ctex: {ctex_path})")
            failed += 1
            continue

        raw_ctex = reader.read_file(ctex_path)
        img_data = extract_webp_from_ctex(raw_ctex)

        if not img_data:
            print(f"  SKIP  {source_path} (extraction failed)")
            failed += 1
            continue

        # Detect format and save
        if img_data[:4] == b"\x89PNG":
            out_path = output_dir / f"{output_name}.png"
            out_path.write_bytes(img_data)
        elif img_data[:4] == b"RIFF":
            # Convert WebP to PNG
            png_data = webp_to_png(img_data)
            out_path = output_dir / f"{output_name}.png"
            out_path.write_bytes(png_data)
        else:
            print(f"  SKIP  {source_path} (unknown format)")
            failed += 1
            continue

        print(f"  OK    {output_name}.png  ({out_path.stat().st_size:,} bytes)")
        extracted += 1

    reader.close()
    print(f"\nDone: {extracted} extracted, {failed} skipped")
    print(f"Output: {output_dir}")


if __name__ == "__main__":
    main()
