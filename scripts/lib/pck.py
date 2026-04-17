"""Godot 4.x PCK reader (format v2 and v3, unencrypted)."""

from __future__ import annotations

import json
import os
import struct
import sys
from dataclasses import dataclass


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

DEFAULT_DLL_PATHS = {
    "darwin": os.path.expanduser(
        "~/Library/Application Support/Steam/steamapps/common/"
        "Slay the Spire 2/SlayTheSpire2.app/Contents/Resources/"
        "data_sts2_macos_arm64/sts2.dll"
    ),
    "win32": r"C:\Program Files (x86)\Steam\steamapps\common\Slay the Spire 2\data_sts2_windows_x86_64\sts2.dll",
    "linux": os.path.expanduser(
        "~/.local/share/Steam/steamapps/common/Slay the Spire 2/data_sts2_linux_x86_64/sts2.dll"
    ),
}


@dataclass
class PCKEntry:
    path: str
    offset: int
    size: int
    md5: bytes
    flags: int


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
            raise ValueError(f"Not a Godot PCK file (magic: {magic!r})")

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

    def read_file(self, path: str) -> bytes:
        entry = self.entries[path]
        self.f.seek(self.files_base + entry.offset)
        return self.f.read(entry.size)

    def read_json(self, path: str):
        return json.loads(self.read_file(path).decode("utf-8"))

    def close(self):
        self.f.close()

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()


def default_pck_path() -> str:
    return DEFAULT_PCK_PATHS[sys.platform]


def default_dll_path() -> str:
    return DEFAULT_DLL_PATHS[sys.platform]


def load_localization(reader: PCKReader, lang: str, table: str) -> dict:
    """Load a localization table (e.g. 'enchantments') for a language ('kor', 'eng')."""
    return reader.read_json(f"localization/{lang}/{table}.json")


def group_loc_by_id(flat: dict[str, str]) -> dict[str, dict]:
    """Convert `{"FOO.title": "x", "FOO.moves.BAR.title": "y"}` to a nested dict by id."""
    result: dict[str, dict] = {}
    for key, value in flat.items():
        parts = key.split(".")
        root = parts[0]
        if root not in result:
            result[root] = {}
        node = result[root]
        for p in parts[1:-1]:
            node = node.setdefault(p, {})
        node[parts[-1]] = value
    return result
