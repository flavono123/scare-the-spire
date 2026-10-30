#!/usr/bin/env python3
"""Build the common-character subset of the GC Batang web font.

The server-rendered Compendium detail ([data-compendium-static-detail]) uses
GC Batang with font-display: optional, so the face is used only when it is
ready within the browser's ~100ms block period. The full WOFF2 (2 MB, 17k
glyphs) takes ~150ms to decode even from the disk cache, so a returning
visitor in a new tab or browser process never got it there. This subset keeps
the glyph metrics of the full font and decodes in ~25ms.

Kept code points (only those the font has):
  - everything except Hangul syllables and CJK ideographs (Latin, digits,
    punctuation, symbols, jamo)
  - the 2,350 Hangul syllables of KS X 1001 (the common modern set)
  - every other character used in the Korean game data and in src (UI
    strings), so rarer syllables in game names (e.g. 핰) are covered too

CJK ideographs are left out (1.4 MB of the full file): Korean game text has
none, and Chinese or Japanese text falls back to the system fonts.

Rerun after a game data update that may add new characters:

  python3 -m pip install fonttools brotli
  python3 scripts/build-gc-batang-common-subset.py
"""

from __future__ import annotations

import sys
from pathlib import Path

try:
    from fontTools import subset
    from fontTools.ttLib import TTFont
except ImportError:
    sys.exit("fontTools is required: python3 -m pip install fonttools brotli")

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "public/fonts/GyeonggiCheonnyeonBatangBold.woff2"
OUTPUT = ROOT / "public/fonts/GyeonggiCheonnyeonBatangBold-common.woff2"
SCAN_DIRS = [ROOT / "data/sts2/kor", ROOT / "data/sts2/localization/kor", ROOT / "src"]
SKIP_DIRS = {ROOT / "src/generated"}
SCAN_SUFFIXES = {".json", ".ts", ".tsx", ".md", ".css"}


def is_hangul_syllable(cp: int) -> bool:
    return 0xAC00 <= cp <= 0xD7A3


def is_cjk_ideograph(cp: int) -> bool:
    return 0x3400 <= cp <= 0x4DBF or 0x4E00 <= cp <= 0x9FFF or 0xF900 <= cp <= 0xFAFF or 0x20000 <= cp <= 0x3FFFF


def ksx1001_hangul() -> set[int]:
    # Rows 0xB0-0xC8 of EUC-KR hold the 2,350 KS X 1001 Hangul syllables.
    out: set[int] = set()
    for hi in range(0xB0, 0xC9):
        for lo in range(0xA1, 0xFF):
            try:
                ch = bytes([hi, lo]).decode("euc-kr")
            except UnicodeDecodeError:
                continue
            if is_hangul_syllable(ord(ch)):
                out.add(ord(ch))
    return out


def used_code_points() -> set[int]:
    out: set[int] = set()
    for base in SCAN_DIRS:
        for path in sorted(base.rglob("*")):
            if path.suffix not in SCAN_SUFFIXES or not path.is_file():
                continue
            if any(skip in path.parents for skip in SKIP_DIRS):
                continue
            out.update(ord(ch) for ch in path.read_text(encoding="utf-8", errors="ignore"))
    return out


def main() -> None:
    cmap = TTFont(SOURCE).getBestCmap()
    available = set(cmap)
    keep = {cp for cp in available if not is_hangul_syllable(cp) and not is_cjk_ideograph(cp)}
    keep |= ksx1001_hangul()
    keep |= {cp for cp in used_code_points() if not is_cjk_ideograph(cp)}
    keep &= available

    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.name_languages = ["*"]
    options.notdef_outline = True
    options.recalc_bounds = False
    options.recalc_timestamp = False
    options.prune_unicode_ranges = False

    font = subset.load_font(str(SOURCE), options)
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=keep)
    subsetter.subset(font)
    subset.save_font(font, str(OUTPUT), options)
    print(f"{OUTPUT.relative_to(ROOT)}: {len(keep)} code points, {OUTPUT.stat().st_size} bytes")


if __name__ == "__main__":
    main()
