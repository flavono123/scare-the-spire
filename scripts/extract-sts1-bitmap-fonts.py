#!/usr/bin/env python3
"""Bake STS1 card BitmapFonts from desktop-1.0.jar using FontHelper FreeType params.

Requires freetype-py (pip install freetype-py) and Pillow.
"""

from __future__ import annotations

import argparse
import json
import sys
import tempfile
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.lib.sts1_bitmap_font import (  # noqa: E402
    ENERGY_BORDER,
    ENERGY_BORDER_COLOR,
    ENERGY_FONT,
    LATIN_BODY_FONT,
    LATIN_PACK_LOCALES,
    LATIN_TYPE_FONT,
    LOCALE_BODY_FONT,
    LOCALE_TYPE_FONT,
    SPECIAL_PACK_LOCALES,
    TITLE_BORDER,
    TITLE_BORDER_COLOR,
    TITLE_SHADOW,
    TITLE_SHADOW_COLOR,
    DESC_SHADOW,
    DESC_SHADOW_COLOR,
    RowPacker,
    collect_strings,
    extra_charset,
    render_role,
)
from scripts.lib.sts1_jar import default_sts1_jar_path, open_sts1_jar  # noqa: E402

IMAGE_OUT = ROOT / "public" / "images" / "sts1" / "fonts"
JSON_OUT = ROOT / "src" / "lib" / "sts1" / "bitmap-fonts"
LOC_ROOT = ROOT / "data" / "sts1" / "localization"

ROLE_SPECS = {
    "title": {
        "size": 27,
        "border": TITLE_BORDER,
        "border_color": TITLE_BORDER_COLOR,
        "shadow": TITLE_SHADOW,
        "shadow_color": TITLE_SHADOW_COLOR,
        "face": "body",
    },
    "desc": {
        "size": 24,
        "border": 0,
        "border_color": TITLE_BORDER_COLOR,
        "shadow": DESC_SHADOW,
        "shadow_color": DESC_SHADOW_COLOR,
        "face": "body",
    },
    "type": {
        "size": 17,
        "border": 0,
        "border_color": TITLE_BORDER_COLOR,
        "shadow": (0, 0),
        "shadow_color": (0, 0, 0, 0),
        "face": "type",
    },
}


def save_webp(image, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    image.save(dest, "WEBP", lossless=True, method=4)


def load_locale_chars(locale: str) -> set[str]:
    chars: set[str] = set(extra_charset())
    folder = LOC_ROOT / locale
    if not folder.is_dir():
        return chars
    for path in folder.glob("*.json"):
        collect_strings(json.loads(path.read_text(encoding="utf-8")), chars)
    return {char for char in chars if char.isprintable() or char == " "}


def extract_font_files(jar, needed: set[str], temp_dir: Path) -> dict[str, Path]:
    paths: dict[str, Path] = {}
    for entry in needed:
        dest = temp_dir / Path(entry).name
        dest.write_bytes(jar.read(entry))
        paths[entry] = dest
    return paths


def bake_pack(
    name: str,
    body_path: Path,
    type_path: Path,
    chars: set[str],
) -> None:
    from freetype import Face

    body = Face(str(body_path))
    type_face = Face(str(type_path))
    packer = RowPacker()
    roles: dict[str, Any] = {}
    faces = {"body": body, "type": type_face}
    for role, spec in ROLE_SPECS.items():
        roles[role] = render_role(
            faces[spec["face"]],
            chars,
            packer,
            size=spec["size"],
            border=spec["border"],
            border_color=spec["border_color"],
            shadow=spec["shadow"],
            shadow_color=spec["shadow_color"],
        )
        print(f"  {name}.{role} glyphs={len(roles[role]['glyphs'])} cap={roles[role]['capHeight']}")
    page = packer.build()
    save_webp(page, IMAGE_OUT / f"{name}.webp")
    payload = {
        "page": f"{name}.webp",
        "pageWidth": page.width,
        "pageHeight": page.height,
        "roles": roles,
    }
    JSON_OUT.mkdir(parents=True, exist_ok=True)
    (JSON_OUT / f"{name}.json").write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"  {name} atlas {page.size}")


def bake_energy(font_path: Path) -> None:
    from freetype import Face

    face = Face(str(font_path))
    packer = RowPacker(max_width=512)
    role = render_role(
        face,
        list("0123456789X"),
        packer,
        size=38,
        border=ENERGY_BORDER,
        border_color=ENERGY_BORDER_COLOR,
        shadow=(0, 0),
        shadow_color=(0, 0, 0, 0),
    )
    page = packer.build()
    save_webp(page, IMAGE_OUT / "energy.webp")
    payload = {
        "page": "energy.webp",
        "pageWidth": page.width,
        "pageHeight": page.height,
        "roles": {"energy": role},
    }
    JSON_OUT.mkdir(parents=True, exist_ok=True)
    (JSON_OUT / "energy.json").write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"  energy glyphs={len(role['glyphs'])} atlas {page.size}")


def extract_bitmap_fonts(jar_path: str | None = None) -> None:
    with open_sts1_jar(jar_path) as jar:
        needed = {LATIN_BODY_FONT, LATIN_TYPE_FONT, ENERGY_FONT}
        needed.update(LOCALE_BODY_FONT.values())
        needed.update(LOCALE_TYPE_FONT.values())
        with tempfile.TemporaryDirectory() as temp:
            temp_dir = Path(temp)
            files = extract_font_files(jar, needed, temp_dir)
            bake_energy(files[ENERGY_FONT])
            latin_chars: set[str] = set()
            for locale in LATIN_PACK_LOCALES:
                latin_chars |= load_locale_chars(locale)
            bake_pack("latin", files[LATIN_BODY_FONT], files[LATIN_TYPE_FONT], latin_chars)
            for locale in SPECIAL_PACK_LOCALES:
                bake_pack(
                    locale,
                    files[LOCALE_BODY_FONT[locale]],
                    files[LOCALE_TYPE_FONT[locale]],
                    load_locale_chars(locale),
                )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--jar", default=default_sts1_jar_path())
    args = parser.parse_args()
    extract_bitmap_fonts(args.jar)


if __name__ == "__main__":
    main()
